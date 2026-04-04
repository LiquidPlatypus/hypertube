from fastapi import FastAPI, HTTPException, status, Query, APIRouter, Depends
from fastapi.responses import JSONResponse
import requests
from fastapi import Request
from auth import tmdb
import os
import pprint
import libtorrent
import threading
import time
from database import get_db, init_db, SessionLocal
from pydantic import BaseModel
from typing import Optional, List
from models_db import get_movie_by_tmdb_id
from typing import List
import shutil
from sqlalchemy.orm import Session
from models_db import Movie
from fastapi import BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.responses import StreamingResponse
import subprocess
import asyncio

router = APIRouter()

torrent_search_api_url = os.getenv("TORRENT_SEARCH_API_URL")

#: dictionnaire pour stocker les handles de téléchargement en cours
#: ex: {movie_id: torrent_handle}
active_downloads = {}

#: data transfer object
class MovieThumbnail(BaseModel):
    id: int
    title: str
    poster_path: Optional[str]
    release_date: str
    score: float
class CastMember(BaseModel):
    actor_name: str
    character_name: str
    actor_picture_path: Optional[str]
class MovieDetails(BaseModel):
    id: int
    title: str
    tagline: str
    overview: str
    poster_path: Optional[str]
    release_date: str
    runtime: int
    score: float
    cast: List[CastMember]
    mp4_path: Optional[str] = None
class TorrentRequest(BaseModel):
    title: str
    year: int
class DownloadRequest(BaseModel):
    id: int
    magnet: str

_lt_session = None

def get_lt_session():
    global _lt_session
    if _lt_session is None:
        _lt_session = libtorrent.session()
        _lt_session.listen_on(6881, 6891)
    return _lt_session

#! THUMBNAILS endpoint
#: recupere une liste de films depuis TMDB API
#: si query, recherche de films correspondant a la query
#: sinon, recupere les films populaires du moment
#: response_model: List[MovieThumbnail] pour ne retourner que les infos voulues, et forcer la validation des données
@router.get("/api/thumbnails", response_model=List[MovieThumbnail])
def get_thumbnails(query: Optional[str] = Query(None), page: int = Query(1, ge=1)):
    
    thumbnails_data = list[MovieThumbnail]()    

    if query and len(query) >= 1:
        #: recherche de films correspondant a la query
        search = tmdb.Search()
        thumbnails_search_results = search.movie(query=query, page=page)
    else:
        #: sans query, recupere les films populaires du moment
        thumbnails_search_results = tmdb.Movies().popular(page=page)

    for movie in thumbnails_search_results["results"]:
        poster = movie.get("poster_path")
        full_poster_path = f"https://image.tmdb.org/t/p/w500{poster}" if poster else None
        thumbnails_data.append({
            "id": movie["id"],
            "title": movie.get("title") or movie.get("original_title"),
            "poster_path": full_poster_path,
            "release_date": movie.get("release_date", "N/A"),
            "score": round(movie.get("vote_average", 0), 1)
        })
    
    return thumbnails_data


#! MOVIE DETAILS endpoint
#: recupere les details d'un film depuis TMDB API, en utilisant son id
#: response_model: MovieDetails pour ne retourner que les infos voulues, et forcer la validation des données
@router.get("/api/movie/{movie_id}", response_model=MovieDetails)
def get_movie_details(movie_id: int, session = Depends(get_db)):

    #: recupere les infos du film et de son casting depuis TMDB API
    movie_search_results = tmdb.Movies(movie_id).info()
    creddits_search_results = tmdb.Movies(movie_id).credits()

    #: stock les infos dans un objet MovieDetails, en formatant comme voulu
    data = MovieDetails(
        id=movie_id,
        title=movie_search_results["original_title"],
        tagline=movie_search_results["tagline"],
        overview=movie_search_results["overview"],
        poster_path=f"https://image.tmdb.org/t/p/w500{movie_search_results['poster_path']}" if movie_search_results.get("poster_path") else None,
        release_date=movie_search_results["release_date"],
        runtime=movie_search_results["runtime"],
        score=movie_search_results["vote_average"],
        cast=[], #: liste d'objet CastMember, on rempli ensuite
        mp4_path=None
    )

    #: On recupere les 5 premiers cast members, et on les stock dans la liste data.cast, en formatant comme voulu
    for actor in creddits_search_results.get("cast", [])[:5]: 
       profile = actor.get("profile_path")
       path = f"https://image.tmdb.org/t/p/w500{profile}" if profile else None
       new_cast_member = CastMember(
            actor_name=actor["name"],
            character_name="as " + actor["character"],
            actor_picture_path=path
        )
       data.cast.append(new_cast_member)
    
    #TODO movie details: check si le film est en bdd pour recup le mp4, sinon, le dl
    stored_movie = get_movie_by_tmdb_id(session, movie_id)
    if stored_movie:
        data.mp4_path = stored_movie.mp4_path

    return data

#! TORRENT SEARCH endpoint
#: call le torrent_search_api container pour trouver un torrent du film cible
#: si on le trouve, on commence le telechargement
#: sinon, on affiche un message a l'utilisateur
@router.post("/api/torrent/search")
def search_torrent(request: TorrentRequest):
    search_query = f"{request.title} {request.year} 1080p"

    providers = [
        '1337x', 'yts', 'piratebay', 'rarbg', 'kickass', 
        'limetorrent', 'bitsearch', 'glodls', 'magnetdl', 
        'nyaasi', 'tgx', 'torlock', 'torrentfunk', 
        'torrentproject', 'eztv', 'ettv', 'zooqle'
    ]

    #: on interroge les providers un par un, jusqu'a trouver un torrent qui correspond a notre recherche
    #: on s'arrete au premier résultat trouvé, et si aucun resultat n'est trouvé, on affiche un message a l'utilisateur
    for provider in providers:
        try:
            print(f"📡 Test sur {provider}...", end="")
            response = requests.get(f"{torrent_search_api_url}/{provider}/{search_query}/1", timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    first_result = data[0]
                    magnet = first_result.get("Magnet") or first_result.get("magnet")
                    
                    if magnet:
                        print(f" ✅ MAGNET TROUVÉ")
                        return {
                            "status": "found",
                            "magnet": magnet
                        }
                print(" ⚪ Aucun résultat")
            else:
                print(f" ❌ Erreur HTTP: {response.status_code}")
        except:
            continue

    return { "status": "not found" }

    
#! TORRENT DOWNLOAD START endpoint
@router.post("/api/torrent/download")
async def download_movie(request: Request, background_tasks: BackgroundTasks):
    body = await request.json()
    movie_id = body.get("id")
    # magnet = body.get("magnet")
    magnet = "magnet:?xt=urn:btih:83b2c0012bd4b764af8752d5f2d4ed270766932c&dn=test_torrent.mp4&xl=106862658&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337%2Fannounce&tr=udp%3A%2F%2Fopen.stealth.si%3A80%2Fannounce&tr=udp%3A%2F%2Fevan.im%3A6969%2Fannounce&tr=https%3A%2F%2Ftracker.pmman.tech%3A443%2Fannounce&tr=udp%3A%2F%2Ftracker.torrent.eu.org%3A451%2Fannounce&tr=udp%3A%2F%2Ftracker.plx.im%3A6969%2Fannounce"

    if not movie_id or not magnet:
        raise HTTPException(status_code=400, detail="ID ou Magnet manquant")

    handle = start_sequential_download(magnet, int(movie_id))
    handle.set_sequential_download(True)
    
    for i in range(20):
        handle.piece_priority(i, 7) # priorité max pour les 20 premiers morceaux (environ les 10 premières secondes du film)

    return {"status": "started"}

def start_sequential_download(magnet: str, movie_id: int):
    print(f"DEBUG: Initialisation session libtorrent pour movie_id: {movie_id}")
    
    ses = get_lt_session()
    
    # Optionnel: on ajoute des trackers de secours si le magnet est trop court
    if "tr=" not in magnet:
        print("DEBUG: Ajout manuel de trackers au magnet nu")
        trackers = [
            "udp://tracker.opentrackr.org:1337/announce",
            "udp://tracker.openbittorrent.com:6969/announce"
        ]
        magnet += "".join([f"&tr={t}" for t in trackers])

    params = {
        'save_path': f'./downloads/{movie_id}',
        'storage_mode': libtorrent.storage_mode_t.storage_mode_sparse,
    }

    handle = libtorrent.add_magnet_uri(ses, magnet, params)
    
    print(f"DEBUG: Magnet ajouté au handle. En attente de peers...")
    active_downloads[movie_id] = {"session": ses, "handle": handle}
    return handle

#! TORRENT DOWNLOAD STATUS endpoint
@router.get("/api/torrent/status/{movie_id}")
def get_download_status(movie_id: int):
    download_data = active_downloads.get(movie_id)
    if not download_data:
        return {"status": "inactive"}
    
    handle = download_data["handle"]
    s = handle.status()
    
    # Traduction de l'état en texte lisible
    state_str = ['queued', 'checking', 'downloading_metadata', 'downloading', 
                 'finished', 'seeding', 'allocating', 'checking_fastresume'][s.state]

    # LOGS CRITIQUES DANS TON TERMINAL
    print(f"--- TORRENT DEBUG (ID: {movie_id}) ---")
    print(f"État: {state_str}")
    print(f"Progrès: {s.progress * 100:.2f}%")
    print(f"Vitesse: {s.download_rate / 1000:.1f} kB/s")
    print(f"Peers connectés: {s.num_peers}")

    pieces = handle.status().pieces
    first_pieces_ready = all(pieces[i] for i in range(min(20, len(pieces))))  # vérifie si les 20 premiers morceaux sont prêts
    
    return {
        "status": state_str,
        "is_streamable": first_pieces_ready,
        "progress": round(s.progress * 100),
        "speed": round(s.download_rate / 1000, 1),
        "peers": s.num_peers
    }


@router.get("/api/stream/{movie_id}")
async def stream_movie(movie_id: int, request: Request):
    base_path = f"./downloads/{movie_id}"
    video_file = None

    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith((".mp4", ".mkv", ".avi")):
                video_file = os.path.join(root, file)
                break
        if video_file:
            break

    if not video_file:
        raise HTTPException(status_code=404, detail="Fichier introuvable")

    total_size = None
    download_data = active_downloads.get(movie_id)
    if download_data:
        info = download_data["handle"].torrent_file()
        if info:
            total_size = info.total_size()

    return await _ffmpeg_stream(video_file)



async def _ffmpeg_stream(video_file: str):
    """Remuxe MKV → MP4 fragmenté via pipe ffmpeg."""
    command = [
        "ffmpeg",
        "-fflags", "+genpts+igndts",
        "-err_detect", "ignore_err",
        "-analyzeduration", "20M",  # laisse ffmpeg analyser plus longtemps le fichier partiel
        "-probesize", "20M",
        "-i", video_file,
        "-map", "0:V:0",    # meilleur flux vidéo
        "-map", "0:a:0",    # premier flux audio
        "-c:v", "copy",
        "-c:a", "aac",      # transcode en AAC (seul codec audio supporté nativement par les navigateurs)
        "-b:a", "192k",
        "-ac", "2",
        "-sn",              # ignore les sous-titres
        "-f", "mp4",
        "-movflags", "frag_keyframe+empty_moov+default_base_moof",
        "-loglevel", "info",
        "pipe:1"  # sortie vers stdout
    ]


    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        bufsize=0
    )

    await asyncio.sleep(2)
    if process.poll() is not None:
        stderr_output = process.stderr.read().decode()
        print(f"FFMPEG ERROR: {stderr_output}")
        raise HTTPException(status_code=500, detail="Erreur lors du traitement vidéo")

    # Thread séparé pour logger stderr ffmpeg → indispensable pour débugger
    def log_stderr():
        for line in process.stderr:
            print(f"[FFMPEG STDERR] {line.decode().strip()}")

    threading.Thread(target=log_stderr, daemon=True).start()

    async def iterfile():
        loop = asyncio.get_event_loop()
        try:
            while True:
                chunk = await loop.run_in_executor(None, process.stdout.read, 256 * 1024)
                if not chunk:
                    break
                yield chunk
        finally:
            process.terminate()
            process.wait()

    return StreamingResponse(
        iterfile(),
        media_type="video/mp4",
        headers={"Cache-Control": "no-cache"}
    )
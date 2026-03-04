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

router = APIRouter()

torrent_search_api_url = os.getenv("TORRENT_SEARCH_API_URL")

ses = libtorrent.session()
ses.listen_on(6881, 6891)

# dictionnaire pour stocker les handles de téléchargement en cours
# ex: {movie_id: torrent_handle}
active_downloads = {}

# data transfer object
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

#! THUMBNAILS endpoint
# recupere une liste de films depuis TMDB API
# si query, recherche de films correspondant a la query
# sinon, recupere les films populaires du moment
# response_model: List[MovieThumbnail] pour ne retourner que les infos voulues, et forcer la validation des données
@router.get("/api/thumbnails", response_model=List[MovieThumbnail])
def get_thumbnails(query: Optional[str] = Query(None), page: int = Query(1, ge=1)):
    
    thumbnails_data = list[MovieThumbnail]()    

    if query and len(query) >= 1:
        # search using query, then select only movies
        search = tmdb.Search()
        thumbnails_search_results = search.movie(query=query, page=page)
    else:
        # no query, get popular movies (updated daily)
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
# recupere les details d'un film depuis TMDB API, en utilisant son id
# response_model: MovieDetails pour ne retourner que les infos voulues, et forcer la validation des données
@router.get("/api/movie/{movie_id}", response_model=MovieDetails)
def get_movie_details(movie_id: int, session = Depends(get_db)):

    # recupere les infos du film et de son casting depuis TMDB API
    movie_search_results = tmdb.Movies(movie_id).info()
    creddits_search_results = tmdb.Movies(movie_id).credits()

    # stock les infos dans un objet MovieDetails, en formatant comme voulu
    data = MovieDetails(
        id=movie_id,
        title=movie_search_results["original_title"],
        tagline=movie_search_results["tagline"],
        overview=movie_search_results["overview"],
        poster_path=f"https://image.tmdb.org/t/p/w500{movie_search_results['poster_path']}" if movie_search_results.get("poster_path") else None,
        release_date=movie_search_results["release_date"],
        runtime=movie_search_results["runtime"],
        score=movie_search_results["vote_average"],
        cast=[], # liste d'objet CastMember, on rempli ensuite
        mp4_path=None
    )

    # On recupere les 5 premiers cast members, et on les stock dans la liste data.cast, en formatant comme voulu
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
# call le torrent_search_api container pour trouver un torrent du film cible
# si on le trouve, on commence le telechargement
# sinon, on affiche un message a l'utilisateur
@router.post("/api/torrent/search")
def search_torrent(request: TorrentRequest):
    # setup de la search_query
    search_query = f"{request.title} {request.year} 1080p"
    print(f"Recherche torrent pour: {search_query}")

    try: 
        # appel YTS
        search_response = requests.get(
        f"{torrent_search_api_url}/api/all/{search_query}",
            timeout=1
        )

        data = search_response.json()

        pprint.pprint(data)

        if data["status"] == "ok" and data["data"]["movie_count"] > 0:
            movie = data["data"]["movies"][0]
            torrent = movie["torrents"][0]
            hash = torrent["hash"]
            movie_title = movie["title"]
            magnet = f"magnet:?xt=urn:btih:{hash}&dn={movie_title}&tr=udp://open.demonii.com:1337/announce&tr=udp://tracker.openbittorrent.com:80"
            file_name = f"{movie_title}.mp4"

            # on renvoie le magnet et le file_name a react qui va appeler le endpoint de dl du torrent
            return {
                "status": "found",
                "magnet": magnet,
                "file_name": file_name
            }
        
        else:
            return {
                "status": "not found",
                "message": "Aucun torrent trouvé pour ce film."
            }
    
    except requests.exceptions.RequestException as e:
        print(f"Erreur lors de la communication avec YTS: {str(e)}")  
        raise HTTPException(status_code=502, detail=f"Erreur de communication avec YTS: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# filtre les fichiers du torrent pour ne télécharger que le .mp4
def filter_torrent_files(handle):
    while not handle.has_metadata():
        time.sleep(1)  # attend que les métadonnées soient disponibles
    
    info = handle.get_torrent_info()
    files = info.files()
    priorities = [0] * files.num_files()  # par défaut, on ne télécharge aucun fichier

    mp4_found = False
    for i, f in enumerate(files):
        if f.path.lower().endswith(".mp4"):
            priorities[i] = 7  # on télécharge ce fichier
            mp4_found = True

    if not mp4_found:
        print("Aucun fichier .mp4 trouvé dans ce torrent.")

    
#! TORRENT DOWNLOAD START endpoint
@router.post("/api/torrent/download")
def start_download(request: DownloadRequest):
    # check si on a deja un dl en cours pour ce film
    if request.id in active_downloads:
        return {"message": "Téléchargement déjà en cours pour ce film."}

    params = {
        "save_path": "./downloads/",  # chemin de sauvegarde du
        "storage_mode": libtorrent.storage_mode_t.storage_mode_sparse,
    }

    handle = libtorrent.add_magnet_uri(ses, request.magnet, params)
    active_downloads[request.id] = handle

    thread = threading.Thread(target=filter_torrent_files, args=(handle,))
    thread.start()

    return {"status": "started", "message": "Téléchargement du torrent lancé."}

#! TORRENT DOWNLOAD STATUS endpoint
@router.get("/api/torrent/status/{movie_id}")
def download_status(movie_id: int):
    handle = active_downloads.get(movie_id)
    if not handle:
        return {"status": "inactive"}
    
    status = handle.status()
    progress = round(status.progress * 100, 2)  # en pourcentage
    download_speed = round(status.download_rate / 1000000, 2)  # en Mo/s
    state_str = str(status.state)

    if handle.is_seed():
        finalize_download(movie_id, handle, SessionLocal()) 
        return {
            "status": "finished",
            "progress": 100.0,
        }

    print(f"Status du téléchargement pour le film {movie_id} : {progress}% à {download_speed} Mo/s, état: {state_str}")
    return {
        "status": "active",
        "progress": progress,
        "speed": download_speed,
        "state": state_str,
        "is_finished": handle.is_seed(),
    }

#! TORRENT DOWNLOAD STOP endpoint
@router.post("/api/torrent/stop/{movie_id}")
def stop_download(movie_id: int):
    handle = active_downloads.get(movie_id)

    if handle:
        ses.remove_torrent(handle)
        del active_downloads[movie_id]
        print(f"Téléchargement pour le film {movie_id} arrêté.")
        return {"status": "stopped", "message": "Téléchargement annulé, fichiers supprimés."}
    return {"status": "not found", "message": "Aucun téléchargement en cours pour ce film."}
    

# enregistre le chemin du mp4 (completement téléchargé) en base de données, et supprime le torrent de la session
def finalize_download(movie_id: int, handle, db: Session):
    try:
        info = handle;get_torrent_info()
        status = handle.status()

        target_file = None
        for i in range(info.num_files()):
            if handle.file_priority(i) == 7:  # si ce fichier était prioritaire, c'est notre .mp4
                target_file = info.files().file_path(i)
                break
        if not target_file:
            return

        source_path = os.path.join("./downloads/", target_file)
        final_path = os.path.join("./movies")
        if not os.path.exists(final_path):
            os.makedirs(final_path)
        
        final_filename = f"movie_{movie_id}.mp4"
        final_path = os.path.join(final_path, final_filename)

        shutil.move(source_path, final_path)
        
        movie = db.query(Movie).filter(Movie.tmdb_id == movie_id).first()
        if movie:
            movie.mp4_path = final_path
            db.commit()
            print(f'Film {movie_id} sauvegardé en BDD : {final_path}')
        
        ses.remove_torrent(handle)
        if movie_id in active_downloads:
            del active_downloads[movie_id]
        
    except Exception as e:
        print(f"Erreur lors de la finalisation du téléchargement et mise en BDD : {e}")
        db.rollback()
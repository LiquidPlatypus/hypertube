import { useState } from "react";
import * as React from "react";
import { useNavigate, useParams } from "react-router-dom";

interface Movie {
    id: number;
    title: string;
    tagline: string;
    overview: string;
    poster_path: string;
    release_date: string;
    runtime: number;
    score: number;
    cast: {
        actor_name: string;
        character_name: string;
        actor_picture_path: string;
    }[];
    mp4_path?: string;
}

//! MOVIE DETAILS PAGE
export default function MovieDetails() {
    const navigate = useNavigate();
    const [Loading, setLoading] = useState(false);
    const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
    const [error, setError] = useState('');
    const { id } = useParams<{ id: string }>();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isStreamable, setIsStreamable] = useState(false);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState({ progress: 0, speed: 0, status: ''});
    const [isSearchingMagnet, setIsSearchingMagnet] = useState(false);
    const [magnet, setMagnet] = useState(null);

    //: recupere les details du film cible depuis le backend et on les stocke dans movieDetails
    const getMovieDetails = async (movieId: number) => {

        //: on indique qu'on est en train de charger des resultats et on set erreur a vide pour reset l'affichage des erreurs précédentes
        setLoading(true);
        setError('');

        try {
            //: appel backend pour recup les details du film via son id
            const url = `/api/movie/${movieId}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            //: si la reponse est pas ok, on throw direct au catch
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            //: on range les details du film dans l'interface Movie et on les stocke dans le state pour affichage
            const data: Movie = await response.json();
            setMovieDetails(data);

            console.log("film chargé:", data.title, data.mp4_path ? "mp4 disponible" : "mp4 non disponible");
        } catch (err) {
            //: en cas de throw, on affiche un message d'erreur et on log dans la console
            setError('Erreur MovieDetails()');
            console.error("Error fetching movie Details:", err);
        }
        //: on remet loading a false
        setLoading(false);
    }

    //: détermine le texte à afficher sur le bouton de téléchargement en fonction de l'état de la recherche du torrent
    const renderButtonText = () => {
        // Si on n'a pas encore lancé le download
        if (!isDownloading) return "Télécharger et Regarder";

        // Si on est en train de récupérer les infos du status
        switch (downloadProgress.status) {
            case 'checking':
                return `Vérification des fichiers : ${downloadProgress.progress}%`;
            case 'downloading_metadata':
                return "Récupération des métadonnées...";
            case 'downloading':
                return `Téléchargement : ${downloadProgress.progress}% (${downloadProgress.speed} KB/s)`;
            case 'finished':
            case 'seeding':
                return "Prêt à visionner";
            default:
                return "Initialisation...";
        }
    };

 
    //: appel le back pour chercher un torrent parmis une liste de providers
    const searchTorrent = async () => {
        if (!movieDetails) return;

        setIsSearchingMagnet(true);
        setMagnet(null);

        //: on cherche un torrent du film
        try {
            const url = `/api/torrent/search`;
            const searchResponse = await fetch(url, {
                method: "POST",
                headers: {"Content-Type": "application/json", },
                body: JSON.stringify({ 
                    title: movieDetails.title,
                    year: new Date(movieDetails.release_date).getFullYear()
                 }),
            });

            const searchData = await searchResponse.json();
            if (searchData.status == "found") {
                //: torrent trouvé
                setMagnet(searchData.magnet);

            }
        } catch (err) {
            console.error("Error while searching for torrent:", err);
        }
        finally {
            //: fin de la recherche de torrent
            setIsSearchingMagnet(false);
        }
    };

    const handleDownload = async () => {
       if (!magnet || !movieDetails) {
        console.error("Magnet ou détails manquants", { magnet, movieDetails });
        return;
        }
        
        console.log("Envoi du download pour ID:", movieDetails.id);
        setIsStreamable(false);
        setVideoUrl(null);

        try {
            const res = await fetch("/api/torrent/download", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    id: Number(movieDetails.id), // Force le type Number
                    magnet: magnet 
                }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                console.error("Erreur serveur détaillée:", errorData);
                return;
            }

            setIsDownloading(true);
        } catch (err) {
            console.error("Erreur fetch download:", err);
        }
    }

    //: fetch movie details quand le composant est monté
    React.useEffect(() => {
        if (id) getMovieDetails(parseInt(id, 10));
    }, [navigate]);

    //: lance la recherche de torrent dès que les details du film sont chargés
    React.useEffect(() => {
        if (movieDetails) searchTorrent();
    }, [movieDetails])

    React.useEffect(() => {
    // On ne lance le polling que si on est en mode téléchargement
    if (!isDownloading || !id) return;

    const fetchStatus = async () => {
        try {
            const res = await fetch(`/api/torrent/status/${id}`);
            if (!res.ok) return;
            
            const data = await res.json();
            console.log("Flux de données reçu:", data); // Pour vérifier dans F12

            // MISE À JOUR DU STATE
            setDownloadProgress({
                progress: data.progress, // Vérifie bien que le nom correspond au JSON du back
                speed: data.speed,
                status: data.status
            });

            // Si le backend dit que c'est streamable, on active le player
            if (data.is_streamable && !isStreamable && data.progress > 0) {
                setIsStreamable(true);
                setVideoUrl(`/api/stream/${id}`);
            }
        } catch (err) {
            console.error("Erreur Polling:", err);
        }
    };

    // On lance le premier appel immédiatement
    fetchStatus();

    // Puis on définit l'intervalle
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
}, [isDownloading, id, isStreamable]); // Dépendances critiques


    //: PAGE
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">

                {/* bouton retour */}
                <button
                    onClick={() => navigate(-1)}
                    className="mb-4 text-sm bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition"
                >
                    ← Retour
                </button>

                {/* titre du film avec l'année de sortie */}
                {movieDetails && (
                    <h2 className="text-3xl font-bold">
                        {movieDetails.title} <span className="font-light opacity-80">({new Date(movieDetails.release_date).getFullYear()})</span>
                    </h2>
                )}

                <div className="p-6">

                    {/* affichage conditionnel : loading, erreur ou details du film */}

                    {Loading && <p className="text-center py-10 text-gray-500 animate-pulse">Chargement...</p>}

                    {error && <p className="text-center py-10 text-red-500 bg-red-50 rounded-lg">{error}</p>}

                    {movieDetails && (
                        <div className="space-y-8">
                            <div className="flex flex-col md:flex-row gap-8">
                                <div className="w-full md:w-64 flex-shrink-0">
                                    <img
                                        src={movieDetails.poster_path ? movieDetails.poster_path : "/placeholder-poster.png"}
                                        alt={movieDetails.title}
                                        className="w-full h-auto rounded-xl shadow-md border border-gray-200"
                                    />
                                </div>

                                <div className="flex-1">
                                    <p className="text-xl italic text-indigo-600 mb-4 font-medium underline decoration-indigo-100 underline-offset-4">
                                        "{movieDetails.tagline}"
                                    </p>

                                    <div className="flex gap-4 mb-6">
                                        <span className="bg-gray-100 px-3 py-1 rounded-full text-sm font-semibold text-gray-700">
                                            ⏱ {movieDetails.runtime} min
                                        </span>
                                        <span className="bg-yellow-100 px-3 py-1 rounded-full text-sm font-semibold text-yellow-700">
                                            ⭐ {movieDetails.score}/10
                                        </span>
                                    </div>

<div className="flex flex-col gap-6">
    {/* Lecteur Vidéo */}
    <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
        {!isStreamable ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900/80">
                {isDownloading && <div className="w-48 h-1 bg-gray-700 mt-4 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 transition-all" style={{ width: `${downloadProgress.progress}%` }}></div>
                </div>}
            </div>
        ) : (
            <video 
                controls 
                className="w-full h-full"
                src={videoUrl || ""}
                poster={movieDetails.poster_path}
            />
        )}
    </div>

    {/* Bouton d'action */}
    <button
        onClick={handleDownload}
        disabled={isSearchingMagnet || !magnet || isDownloading}
        className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
            magnet && !isDownloading ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg" : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
    >
        {renderButtonText()}
    </button>
</div>

                                    <h3 className="text-lg font-bold text-gray-800 mb-2">Synopsis</h3>
                                    <p className="text-gray-600 leading-relaxed text-justify">
                                        {movieDetails.overview}
                                    </p>
                                </div>
                            </div>

                            <hr className="border-gray-100" />
                            <div>
                                <h4 className="text-xl font-bold text-gray-800 mb-6">Casting Principal</h4>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {movieDetails.cast.map((member, index) => (
                                        <div key={index} className="flex flex-col items-center text-center p-2 rounded-lg hover:bg-gray-50 transition">
                                            <img
                                                src={member.actor_picture_path}
                                                alt={member.actor_name}
                                                className="w-16 h-16 rounded-full object-cover mb-2 border-2 border-indigo-50 shadow-sm"
                                            />
                                            <p className="text-sm font-bold text-gray-800 leading-tight line-clamp-1">{member.actor_name}</p>
                                            <p className="text-xs text-gray-500 italic line-clamp-1">{member.character_name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

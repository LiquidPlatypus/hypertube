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
    // const [downloadProgress, setDownloadProgress] = useState({ progress: 0, speed: 0, status: ''});
    const [YTSStatus, setYTSStatus ] = useState('');


    // recupere les details du film cible depuis le backend et on les stocke dans movieDetails
    const getMovieDetails = async (movieId: number) => {

        // on indique qu'on est en train de charger des resultats et on set erreur a vide pour reset l'affichage des erreurs précédentes
        setLoading(true);
        setError('');

        try {
            // appel backend pour recup les details du film via son id
            const url = `/api/movie/${movieId}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            // si la reponse est pas ok, on throw direct au catch
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            // on range les details du film dans l'interface Movie et on les stocke dans le state pour affichage
            const data: Movie = await response.json();
            setMovieDetails(data);

            console.log("film chargé:", data.title, data.mp4_path ? "mp4 disponible" : "mp4 non disponible");
        } catch (err) {
            // en cas de throw, on affiche un message d'erreur et on log dans la console
            setError('Erreur MovieDetails()');
            console.error("Error fetching movie Details:", err);
        }
        // on remet loading a false
        setLoading(false);
    }

    // appel le back pour chercher, puis telecharger le torrent du film cible.
    const handleDownload = async () => {
        if (!movieDetails) return;

        // On signale qu'on est en train de chercher un torrent
        setYTSStatus ("Recherche de torrent...");

        // on cherche un torrent du film
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
                // on a trouvé un torrent, on lance le dl
                setYTSStatus ("Torrent trouvé. Initialisation du téléchargement...");
                const url = `/api/torrent/download`;
                const dlResponse = await fetch(url, {
                    method: "POST",
                    headers: {"Content-Type": "application/json", },
                    body: JSON.stringify({
                        id: movieDetails.id,
                        magnet: searchData.magnet
                    }),
                });
                if (dlResponse.ok) {
                    setYTSStatus ("Téléchargement lancé !");
                    // setIsDownloading(true) pour commencer le polling du status du torrent dans le useEffect
                    setIsDownloading(true);
                }
            } else {
                setYTSStatus("Torrent indisponible. Retentez dans 24h.");
                setIsDownloading(false);
                return;
            }
        } catch (err) {
            setYTSStatus ("Erreur lors de la recherche du torrent");
            setIsDownloading(false);
            console.error("Error while searching for torrent:", err);
        }
    };

    // appel le bacj pour stopper le telechargement en cours
    const handleStopDownload = async () => {
        if (!movieDetails) return;

        try {
            const response = await fetch(`/api/torrent/stop/${movieDetails.id}`, {
                method: "POST",
                headers: {"Content-Type": "application/json", },
            });
            if (response.ok) {
                setIsDownloading(false);
                setYTSStatus("Téléchargement arrêté.");
            }
        } catch (err) {
        console.log("Erreur lors de la tentative d'arrêt du téléchargement: ", err);
        }
    };

    // fetch movie details quand le composant est monté
    React.useEffect(() => {
        if (id) getMovieDetails(parseInt(id, 10));
    }, [navigate]);

    // actualisation du status du 
    // arret du telechargement si on quitte la page
    React.useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        
        // si on est en train de chercher un torrent, on met à jour le status toutes les 5 secondes
        if (movieDetails && isDownloading) {
            interval = setInterval(async () => {
                try {
                    const response = await fetch(`/api/torrent/status/${movieDetails.id}`);
                    const data = await response.json();
                    console.log("Status du torrent:", data);

                    if (data.status === 'active') {
                        setYTSStatus(`Téléchargement en cours... ${data.progress}%  (${data.speed} Mo/s)`);
                        if (data.is_finished) {
                            setYTSStatus("Téléchargement terminé !");
                            setIsDownloading(false);
                            clearInterval(interval);
                        }
                    }
                } catch (err) {
                    console.error("Error fetching torrent status:", err);
                }
            }, 5000);


        }

        // on quitte la page
        return () => {
            if (interval) clearInterval(interval);
            if (isDownloading) handleStopDownload();
        }
    }, [isDownloading, movieDetails]);


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

                                    <div className="flex gap-4 mb-6">

                                        {/* bouton download */}
                                        {!isDownloading ? (
                                            <button
                                                onClick={handleDownload}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow transition"
                                            >
                                                Télécharger le torrent
                                            </button>
                                        ) : (
                                            <button
                                                onClick={handleStopDownload}
                                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg shadow transition"
                                            >
                                                Arrêter le téléchargement
                                            </button>
                                        )}
                                        {YTSStatus && (
                                            <p className="text-sm mt-2 text-indigo-600 font-medium italic">
                                                {YTSStatus}
                                            </p>
                                        )}


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

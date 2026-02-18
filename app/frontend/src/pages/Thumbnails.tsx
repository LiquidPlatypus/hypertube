import { useState, useCallback } from "react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

interface Thumbnail {
    id: number;
    title: string;
    poster_path: string;
    release_date: string;
    score: number;
}

export default function Thumbnails() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<Thumbnail[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observer = React.useRef<IntersectionObserver | null>(null);

    const loadMovies = useCallback(async (query: string, pageNum: number, isNewSearch: boolean) => {
        if (loading) return;
        setLoading(true);
        setError('');

        try {
            const url = query
                ? `/api/thumbnails?query=${encodeURIComponent(query)}&page=${pageNum}`
                : `/api/thumbnails?page=${pageNum}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data: Thumbnail[] = await response.json();
            if (data.length === 0) {
                setHasMore(false);
            } else {
                // Si c'est une nouvelle recherche, on remplace les résultats. Sinon, on les ajoute à la liste existante.
                setResults(prev => isNewSearch ? data : [...(prev || []), ...data]);
                setHasMore(true);
            }
        } catch (err) {
            setError('Erreur lors de la recherche des films. Le backend est-il lancé ?');
            console.error("Error fetching thumbnails:", err);  // Debug: Afficher l'erreur
        } finally {
            setLoading(false);
        };
    }, [loading]);

    React.useEffect(() => {
        loadMovies("", 1, true);
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setResults([]);
        setPage(1);
        loadMovies(searchTerm, 1, true);
    };

    const lastMovieElementRef = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        // Si on a déjà un observer, on le déconnecte avant d'en créer un nouveau
        if (observer.current) observer.current.disconnect();

        // On crée un nouvel observer qui va surveiller le dernier élément de la liste
        observer.current = new IntersectionObserver(entries => {
            // Si le dernier élément est visible et qu'on a encore des résultats à charger, on charge la page suivante
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => {
                    const nextPage = prevPage + 1;
                    loadMovies(searchTerm, nextPage, false);
                    return nextPage;
                });
            }
        });
        // Si le node existe, on commence à l'observer
        if (node) observer.current.observe(node);
    }, [loading, hasMore, searchTerm, loadMovies]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8 font-sans">
            <div className="bg-white p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-2xl mt-4 sm:mt-10 border border-gray-200">

                {/* Barre de recherche */}
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Rechercher un film/torrent</h2>
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mb-6">
                    <input
                        type="text"
                        placeholder="Rechercher un titre (ex: Inception)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-grow p-3 border-2 border-indigo-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 transition duration-200 shadow-inner"
                    />
                    <button
                        disabled={loading}
                        type="submit"
                        className={`font-bold py-3 px-6 rounded-xl transition duration-200 shadow-md transform hover:scale-[1.02]
                            ${loading
                                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                                : "bg-indigo-600 text-white hover:bg-indigo-700"
                            }`
                        }
                    >
                        {loading ? "Chargement..." : "Rechercher"}
                    </button>
                </form>
                {/* Affichage des résultats */}
                {results && results.length > 0 && (

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {results.map((thumbnail, index) => {
                            // Si c'est le DERNIER élément de la liste actuelle
                            if (results.length === index + 1) {
                                return (
                                    <div
                                        ref={lastMovieElementRef} // ref observer ici
                                        key={thumbnail.id}
                                        className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
                                        onClick={() => navigate(`/movie/${thumbnail.id}`)}
                                    >
                                        <img
                                            src={thumbnail.poster_path ? thumbnail.poster_path : '/placeholder.png'}
                                            alt={thumbnail.title}
                                            className="w-full h-72 object-cover"
                                        />
                                        <div className="p-4">
                                            <h3 className="text-lg font-semibold text-gray-800 mb-2">{thumbnail.title}</h3>
                                            <p className="text-gray-600 mb-1">Date de sortie: {thumbnail.release_date}</p>
                                            <p className="text-yellow-500 font-bold">Score: {thumbnail.score}</p>
                                        </div>
                                    </div>
                                );
                            } else {
                                // Pour tous les autres éléments, on n'ajoute pas la ref de l'observer
                                return (
                                    <div
                                        key={thumbnail.id}
                                        className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-2xl transition-shadow duration-300 cursor-pointer"
                                        onClick={() => navigate(`/movie/${thumbnail.id}`)}
                                    >
                                        <img
                                            src={thumbnail.poster_path ? thumbnail.poster_path : '/placeholder.png'}
                                            alt={thumbnail.title}
                                            className="w-full h-72 object-cover"
                                        />
                                        <div className="p-4">
                                            <h3 className="text-lg font-semibold text-gray-800 mb-2">{thumbnail.title}</h3>
                                            <p className="text-gray-600 mb-1">Date de sortie: {thumbnail.release_date}</p>
                                            <p className="text-yellow-500 font-bold">Score: {thumbnail.score}</p>
                                        </div>
                                    </div>
                                );
                            }
                        })}
                    </div>
                )}
                {loading && (
                    <div className="flex justify-center mt-6">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700 font-medium mt-4 rounded-lg">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

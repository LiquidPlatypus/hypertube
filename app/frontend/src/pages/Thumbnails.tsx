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

//! THUMBNAILS PAGE
export default function Thumbnails() {

    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState("");
    const [results, setResults] = useState<Thumbnail[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const observer = React.useRef<IntersectionObserver | null>(null);

    // recupere une page de thumbnails (20) depuis le backend, en fonction de la query et du numero de page.
    // si c'est une nouvelle recherche, on remplace les resultats. sinon, on les append à la liste.
    // "useCallback" permet de memoriser la fonction entre les rendus, pour eviter de la recreer a chaque fois. elle ne sera recreee que si "loading" change.
    //TODO duplicates dans les films loadés par l'osbserver, a corriger
    const loadMovies = useCallback(async (query: string, pageNum: number, isNewSearch: boolean) => {

        // si on est deja en train de charger des resultats, on ne fait rien pour eviter les appels multiples au backend
        if (loading) return;

        // on indique qu'on est en train de charger des resultats et on set erreur a vide pour reset l'affichage des erreurs précédentes
        setLoading(true);
        setError('');

        try {
            // appel au backend pour recuperer les thumbnails
            // sans recherche, un obitient une page (20) des films populaire du moment (le premier appel en arrivant sur la page)
            const url = query
                ? `/api/thumbnails?query=${encodeURIComponent(query)}&page=${pageNum}`
                : `/api/thumbnails?page=${pageNum}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });

            //  si la reponse n'est pas ok, on throw direct au catch
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data: Thumbnail[] = await response.json();
            if (data.length === 0) // on verifie la longeur des resultats pour savoir si on a encore des pages a charger
                setHasMore(false);
            else {
                 // si c'est une nouvelle recherche, on remplace les resultats. sinon, on les ajoute à la liste.
                setResults(prev => isNewSearch ? data : [...(prev || []), ...data]);
                setHasMore(true);
            }

        } catch (err) {
            // en cas de throw, on affiche un message d'erreur et on log dans la console
            setError('Erreur lors de la recherche des films. Le backend est-il lancé ?');
            console.error("Error fetching thumbnails:", err);
        } finally {
            // on remet loading a false
            setLoading(false);
        };

    }, [loading]);


    // ref de l'observer pour le scroll infini. 
    // on observe le dernier element de la liste, et quand visible, on appel la page suivante.
    const observerReference = useCallback((node: HTMLDivElement) => {
        // si on est deja en train de charger des resultats, on ne fait rien pour eviter les appels multiples au backend
        if (loading) return;
        // si on a deja un observer, on le deconnecte avant d'en créer un nouveau
        if (observer.current) observer.current.disconnect();

        // on cree un nouvel observer qui va surveiller le dernier element de la liste
        observer.current = new IntersectionObserver(entries => {
            // "isIntersecting" = est visible dans le viewport
            // si le dernier element est visible et qu'on a encore des pages a charger, on charge la page suivante
            if (entries[0].isIntersecting && hasMore) {
                setPage(prevPage => {
                    const nextPage = prevPage + 1;
                    loadMovies(searchTerm, nextPage, false);
                    return nextPage;
                });
            }
        });
        // si le node existe, on commence à l'observer
        // si pas de note, c'est que la liste est vide ou qu'on a pas encore de resultats, donc pas besoin d'observer
        if (node) observer.current.observe(node);
    }, [loading, hasMore, searchTerm, loadMovies]);

    // gestion du formulaire de recherche. on reset les resultats et on charge la page 1 de la query.
    const handleSearchBar = (e: React.FormEvent) => {
        e.preventDefault();
        setResults([]);
        setPage(1);
        loadMovies(searchTerm, page, true);
    };

    // au chargement de la page, on charge les films populaires du moment (page 1, sans query)
    React.useEffect(() => {
        loadMovies("", page, true);
    }, []);

    // affichage de la page
    // une barre de recherche
    // puis resultats sous forme de cards. chaque card est cliquable pour aller sur la page de details du film.
    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8 font-sans">
            <div className="bg-white p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-2xl mt-4 sm:mt-10 border border-gray-200">

                {/* barre de recherche */}
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Rechercher un film/torrent</h2>
                <form onSubmit={handleSearchBar} className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 mb-6">
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

                {/* affichage des resultats */}
                {results && results.length > 0 && (

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {results.map((thumbnail, index) => (
                            <div
                                // observer ici, seulement si c'est le dernier element de la liste
                                ref={results.length === index + 1 ? observerReference : null}
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
                        ))}
                    </div>
                )}

                {/* message d'erreur si erreur il y a */}
                {error && (
                    <div className="p-3 bg-red-100 border-l-4 border-red-500 text-red-700 font-medium mt-4 rounded-lg">
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
}

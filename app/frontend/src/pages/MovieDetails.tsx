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
}

export default function MovieDetails() {
    const navigate = useNavigate();
    const [Loading, setLoading] = useState(false);
    const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
    const [error, setError] = useState('');
    const { id } = useParams<{ id: string }>();


    const getMovieDetails = async (movieId: number) => {
        setLoading(true);
        try {
            const url = `/api/movie/${movieId}`;
            const response = await fetch(url, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                },
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data: Movie = await response.json();
            setMovieDetails(data);
        } catch (err) {
            setError('Erreur lors de la recherche des films. Le backend est-il lancé ?');
            console.error("Error fetching Movies:", err);  // Debug: Afficher l'erreur
        }
        setLoading(false);
    }

    React.useEffect(() => {
        if (id) {
            getMovieDetails(parseInt(id, 10));
        } else {
            setError("ID de film invalide.");
        }
    }, [navigate]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 sm:p-8 font-sans">
            <div className="bg-white p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-4xl mt-4 sm:mt-10 border border-gray-200">
                {/* Détails du film */}
                <h2 className="text-3xl font-extrabold text-indigo-700 mb-6 border-b-4 border-indigo-100 pb-2">Détails du Film</h2>
                <div className="mb-8 w-full">
                </div>
                {Loading && <p className="text-center text-gray-500 mt-6">Chargement des détails du film...</p>}
                {error && <p className="text-center text-red-500 mt-6">{error}</p>}
                {movieDetails && (
                    <div className="mt-6">
                        <h3 className="text-2xl font-bold mb-2">{movieDetails.title} ({new Date(movieDetails.release_date).getFullYear()})</h3>
                        <p className="italic text-gray-600 mb-4">{movieDetails.tagline}</p>
                        <div className="flex mb-6">
                            <img
                                src={movieDetails.poster_path}
                                alt={`${movieDetails.title} Poster`}
                                className="w-48 h-auto rounded-lg shadow-md mr-6"
                            />
                            <div>
                                <p className="mb-2"><strong>Durée:</strong> {movieDetails.runtime} minutes</p>
                                <p className="mb-2"><strong>Score:</strong> {movieDetails.score}/10</p>
                                <p className="mb-4">{movieDetails.overview}</p>
                            </div>
                        </div>
                        <h4 className="text-xl font-semibold mb-3">Casting Principal</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {movieDetails.cast.map((member, index) => (
                                <div key={index} className="flex items-center">
                                    <img
                                        src={member.actor_picture_path}
                                        alt={member.actor_name}
                                        className="w-16 h-16 rounded-full mr-4"
                                    />
                                    <div>
                                        <p className="font-semibold">{member.actor_name}</p>
                                        <p className="text-gray-600">{member.character_name}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

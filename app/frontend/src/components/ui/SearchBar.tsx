import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../hooks/useTranslation.tsx";
import SearchThumbnail from "./SearchThumbnail.tsx";
import * as React from "react";


import styles from "./SearchBar.module.css";

// Mock movies pour développement
const mockMovies = [
  { id: 1, title: "Inception", year: 2010, rating: 87, genre: "Sci-Fi", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Inception" },
  { id: 2, title: "Interstellar", year: 2014, rating: 91, genre: "Sci-Fi", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Interstellar" },
  { id: 3, title: "Matrix", year: 1999, rating: 88, genre: "Action", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Matrix" },
  { id: 4, title: "The Dark Knight", year: 2008, rating: 94, genre: "Action", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "The Dark Knight" },
  { id: 5, title: "Forrest Gump", year: 1994, rating: 89, genre: "Drama", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Forrest Gump" },
  { id: 6, title: "Pulp Fiction", year: 1994, rating: 92, genre: "Crime", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Pulp Fiction" },
  { id: 7, title: "The Lord of the Rings: The Fellowship of the Ring", year: 2001, rating: 91, genre: "Fantasy", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "LOTR: Fellowship" },
  { id: 8, title: "Gladiator", year: 2000, rating: 87, genre: "Action", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Gladiator" },
  { id: 9, title: "The Shawshank Redemption", year: 1994, rating: 95, genre: "Drama", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "Shawshank Redemption" },
  { id: 10, title: "The Avengers", year: 2012, rating: 88, genre: "Action", thumbnailSrc: "/assets/elementor-placeholder-image.png", thumbnailAlt: "The Avengers" },
];

interface SearchBarProps {
	closeSearch: () => void;
	currentLang: string;
}

export default function SearchBar({ closeSearch }: SearchBarProps) {
	const { t } = useTranslation();
	const [searchValue, setSearchValue] = useState("");
	const [results, setResults] = useState<any[]>([]);
	const [ratingFilter, setRatingFilter] = useState(0);
	const [yearFilter, setYearFilter] = useState(0);
	const [genreFilter, setGenreFilter] = useState("");
	const navigate = useNavigate();

	// Filtrage des films
	const filterMovies = (search: string, minRating: number, year: number, genre: string) => {
		// Partie backend à brancher plus tard
		// fetch(`/api/movies?search=${search}&minRating=${minRating}&year=${year}&genre=${genre}`)
		//   .then(res => res.json())
		//   .then(data => setResults(data));

		// Pour l'instant, on filtre les mockMovies
		const filtered = mockMovies.filter(movie =>
			movie.title.toLowerCase().includes(search.toLowerCase()) &&
			movie.rating >= minRating &&
			(year === 0 || movie.year === year) &&
			(genre === "" || movie.genre.toLowerCase() === genre.toLowerCase())
		);

		setResults(filtered);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchValue(value);
		filterMovies(value, ratingFilter, yearFilter, genreFilter);
	};

	const handleRatingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = parseInt(e.target.value);
		setRatingFilter(value);
		filterMovies(searchValue, value, yearFilter, genreFilter);
	};

	const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = parseInt(e.target.value);
		setYearFilter(value);
		filterMovies(searchValue, ratingFilter, value, genreFilter);
	};

	const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		const value = e.target.value;
		setGenreFilter(value);
		filterMovies(searchValue, ratingFilter, yearFilter, value);
	};
	
	const resetFilters = () => {
		setSearchValue("");
		setRatingFilter(0);
		setYearFilter(0);
		setGenreFilter("");
		setResults([]);
	};

	const goToMovie = (movie: any) => {
		navigate("/wipvideo", { state: movie });
		closeSearch(); // fermer la barre de recherche
	};

	return (
		<div className={styles.SearchBarContainer}>
			<div className={styles.SearchRow}>
			<input
				type="text"
				className={styles.SearchBar}
				placeholder="Search..."
				value={searchValue}
				onChange={handleChange}
			/>
			<button className={styles.ResetBtn} onClick={resetFilters}>🔄</button>
			</div>


			{/* Filtres */}
			<div className={styles.FiltersContainer}>
				<select value={ratingFilter} onChange={handleRatingChange}>
					<option value={0}>{t("search.allRatings")}</option>
					<option value={50}>≥ 50%</option>
					<option value={60}>≥ 60%</option>
					<option value={70}>≥ 70%</option>
					<option value={80}>≥ 80%</option>
					<option value={90}>≥ 90%</option>
				</select>

				<select value={yearFilter} onChange={handleYearChange}>
					<option value={0}>{t("search.allYears")}</option>
					<option value={1999}>1999</option>
					<option value={2010}>2010</option>
					<option value={2014}>2014</option>
				</select>

				<select value={genreFilter} onChange={handleGenreChange}>
					<option value="">{t("search.allGenres")}</option>
					<option value="Action">{t("search.action")}</option>
					<option value="Adventure">{t("search.adventure")}</option>
					<option value="Comedy">{t("search.comedy")}</option>
					<option value="Drama">{t("search.drama")}</option>
					<option value="Horror">{t("search.horror")}</option>
					<option value="Thriller">{t("search.thriller")}</option>
					<option value="Romance">{t("search.romance")}</option>
					<option value="Sci-Fi">{t("search.scifi")}</option>
					<option value="Fantasy">{t("search.fantasy")}</option>
					<option value="Animation">{t("search.animation")}</option>
					<option value="Documentary">{t("search.documentary")}</option>
				</select>
			</div>

			{/* Affiche uniquement les résultats */}
			{results.length > 0 && (
			<div className={styles.ThumbnailsContainer}>
				{results.reduce<React.ReactNode[][]>((rows, movie, index) => {
				if (index % 2 === 0) rows.push([]);
				rows[rows.length - 1].push(
					<SearchThumbnail
					key={movie.id}
					thumbnailSrc={movie.thumbnailSrc}
					title={movie.title}
					year={movie.year}
					rating={movie.rating}
					onClick={() => goToMovie(movie)}
					/>
				);
				return rows;
				}, []).map((row, rowIndex) => (
				<div key={rowIndex} className={styles.ThumbnailsRow}>
					{row}
				</div>
				))}
			</div>
			)}
		</div>
	);
}
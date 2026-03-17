import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSearch } from "../utils/searchContext.tsx";

import {useTranslation} from "../hooks/useTranslation.tsx";

import Thumbnail from "../components/ui/Thumbnail.tsx";

import styles from "./HomePage.module.css";

interface Movie {
	id: number;
	title: string;
	poster_path: string;
	release_date: string;
	score: number;
}

export default function HomePage() {
	const navigate = useNavigate();

	const { searchTerm } = useSearch();
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { t } = useTranslation();

	useEffect(() => {
		let cancelled = false;

		// Show loader only if load time > 250ms.
		setShowLoader(false);
		const loaderTimer = window.setTimeout(() => {
			if (!cancelled) setShowLoader(true);
		}, 250);

		const fetchData = async () => {
			setLoading(true);
			setError(null);

			try {
				const url = searchTerm
					? `/api/thumbnails?query=${encodeURIComponent(searchTerm)}`
					: `/api/thumbnails`;

				const res = await fetch(url);
				if (!res.ok) {
					throw new Error (`HTTP ${res.status}`);
				}

				const data = (await res.json()) as Movie[];
				if (!cancelled) setResults(data);
			} catch (e) {
				if (!cancelled) {
					setResults([]);
					setError(e instanceof Error ? e.message : t("error.unknow"));
				}
			} finally {
				window.clearTimeout(loaderTimer);
				if (!cancelled) {
					setLoading(false);
					setShowLoader(false);
				}
			}
		};

		fetchData();

		return () => {
			cancelled = true;
			window.clearTimeout(loaderTimer);
		}
	}, [searchTerm]);

	const handleThumbnailClick = (movieId: number) => {
		navigate(`/movie/${movieId}`);
	};

	return (
		<div className={styles.content}>
			{loading && showLoader && (
				<div>
					{t("loading")}
				</div>
			)}

			{error && <div>{t("error")}{error}</div>}

			<ul className={styles.thumbnails}>
				{results.map((movie: Movie) => (
					<li key={movie.id}>
						<Thumbnail
							thumbnailSrc={movie.poster_path}
							thumbnailAlt={movie.title}
							title={movie.title}
							year={movie.release_date}
							rating={movie.score}
							onClick={() => handleThumbnailClick(movie.id)}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
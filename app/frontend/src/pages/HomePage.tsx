import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
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
	const [results, setResults] = useState<Movie[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const observer = React.useRef<IntersectionObserver | null>(null);

	const { t } = useTranslation();

	// Affiche le loader uniquement si le chargement dure > 250ms (évite les flashs).
	useEffect(() => {
		let cancelled = false;
		let loaderTimer: number | undefined;

		if (loading) {
			setShowLoader(false);
			loaderTimer = window.setTimeout(() => {
				if (!cancelled) setShowLoader(true);
			}, 250);
		} else {
			setShowLoader(false);
		}

		return () => {
			cancelled = true;
			if (loaderTimer) window.clearTimeout(loaderTimer);
		};
	}, [loading]);

	const isFetchingRef = React.useRef(false);

	const loadMovies = useCallback(async (query: string, pageNum: number, isNewSearch: boolean) => {
		if (isFetchingRef.current) return;
		isFetchingRef.current = true;
		setLoading(true);

		setError("");

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

			const data: Movie[] = await response.json();
			if (data.length === 0)
				setHasMore(false);
			else {
				setResults(prev => {
					const merged = isNewSearch ? data : [...prev, ...data];
					return Array.from(new Map(merged.map(m => [m.id, m])).values());;
				});
				setHasMore(true);
			}
		} catch (err) {
			setError("Erreur lors de la recherche de films. Le backend eest-il lancé ?");
			console.error("Error fetching thumbnails:", err);
		} finally {
			setLoading(false);
			isFetchingRef.current = false;
		}
	}, []);

	const observerReference = useCallback((node: HTMLLIElement | null) => {
		if (!node) return;

		observer.current?.disconnect();

		observer.current = new IntersectionObserver(
			entries => {
				const first = entries[0];
				if (first.isIntersecting && hasMore && !isFetchingRef.current) {
					setPage(p => p + 1);
				}
			},
			{ rootMargin: "200px 0px", threshold: 0 }
		);

		observer.current.observe(node);
	}, [hasMore]);

	const handleThumbnailClick = (movieId: number) => {
		navigate(`/movie/${movieId}`);
	};

	useEffect(() => {
		setResults([]);
		setPage(1);
		setHasMore(true);
	}, [searchTerm]);

	useEffect(() => {
		loadMovies(searchTerm, page, page === 1);
	}, [page, searchTerm, loadMovies]);

	useEffect(() => {
		return () => {
			observer.current?.disconnect();
		}
	}, []);

	return (
		<div className={styles.content}>
			{loading && showLoader && (
				<div>
					{t("loading")}
				</div>
			)}

			{error && <div>{t("error")}{error}</div>}

			<ul className={styles.thumbnails}>
				{results.map((movie: Movie, index: number) => {
					const isLast = index === results.length - 1;

					return (
						<li
							key={movie.id}
							ref={isLast ? observerReference : null}
						>
							<Thumbnail
								thumbnailSrc={movie.poster_path}
								thumbnailAlt={movie.title}
								title={movie.title}
								year={movie.release_date}
								rating={movie.score}
								onClick={() => handleThumbnailClick(movie.id)}
							/>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
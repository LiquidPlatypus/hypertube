import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useSearch } from "../utils/searchContext.tsx";
import {type FiltersState, useFilters} from "../utils/filterContext.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";
import { getCurrentLang } from "../lang/i18n.tsx";

import Thumbnail from "../components/ui/Thumbnail.tsx";
import FiltersBar from "../components/ui/FiltersBar.tsx";

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
	const { filters } = useFilters();

	const resettingRef = React.useRef(false);
	const [results, setResults] = useState<Movie[]>([]);
	const [hasMore, setHasMore] = useState(true);
	const [page, setPage] = useState(1);
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const observer = React.useRef<IntersectionObserver | null>(null);

	const { t } = useTranslation();

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

	const loadMovies = useCallback(
		async (query: string, pageNum: number, isNewSearch: boolean, filters: FiltersState) => {
			if (isFetchingRef.current) return;
			isFetchingRef.current = true;
			setLoading(true);
			setError("");

			try {
				const params = new URLSearchParams();

				function normalizeRating(rating: number): number {
					if (rating <= 10) return rating;
					return rating / 10;
				}

				if (filters.minRating !== null) {
					const rating = normalizeRating(filters.minRating);
					params.set("min_rating", String(rating));
				}

				params.set("page", String(pageNum));

				if (query) params.set("query", query);

				if (filters.genreId != null) params.set("genre", String(filters.genreId));
				if (filters.minRating != null) {
					const minRatingTmdb = filters.minRating / 10; // 65 -> 6.5
					params.set("min_rating", String(minRatingTmdb));
				}
				if (filters.yearFrom != null) params.set("year_from", String(filters.yearFrom));
				if (filters.yearTo != null) params.set("year_to", String(filters.yearTo));
				if (filters.sort) params.set("sort", filters.sort);
				params.set("language", getCurrentLang() === "fr" ? "fr-FR" : "en-US");

				const url = `/api/thumbnails?${params.toString()}`;

				const response = await fetch(url, {
					method: "GET",
					headers: { "Content-Type": "application/json" },
				});

				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

				const data: Movie[] = await response.json();
				if (pageNum === 1) resettingRef.current = false;

				if (data.length === 0) {
					setHasMore(false);
				} else {
					setResults((prev) => {
						const merged = isNewSearch ? data : [...prev, ...data];
						return Array.from(new Map(merged.map((m) => [m.id, m])).values());
					});
					setHasMore(true);
				}
			} catch (err) {
				setError("Erreur lors de la recherche de films.");
				console.error("Error fetching thumbnails:", err);
			} finally {
				setLoading(false);
				isFetchingRef.current = false;
			}
		},
		[]
	);

	const observerReference = useCallback(
		(node: HTMLLIElement | null) => {
			if (!node) return;

			observer.current?.disconnect();

			observer.current = new IntersectionObserver(
				(entries) => {
					const first = entries[0];
					if (first.isIntersecting && hasMore && !isFetchingRef.current && !resettingRef.current) {
						setPage((p) => p + 1);
					}
				},
				{ rootMargin: "200px 0px", threshold: 0 }
			);

			observer.current.observe(node);
		},
		[hasMore]
	);

	const handleThumbnailClick = (movieId: number) => {
		navigate(`/movie/${movieId}`);
	};

	useEffect(() => {
		resettingRef.current = true;
		isFetchingRef.current = false;
		setResults([]);
		setHasMore(true);
		setPage(1);

		loadMovies(searchTerm, 1, true, filters).finally(() => {
			resettingRef.current = false;
		});

		observer.current?.disconnect();
	}, [searchTerm, filters, loadMovies]);

	useEffect(() => {
		if (page === 1) return;
		loadMovies(searchTerm, page, page === 1, filters);
	}, [page, searchTerm, loadMovies]);

	useEffect(() => {
		return () => observer.current?.disconnect();
	}, []);

	return (
		<div className={styles.content}>
			<div style={{ width: "100%" }}>
				<FiltersBar />

				{loading && showLoader && <div>{t("loading")}</div>}

				{error && (
					<div>
						{t("error")}
						{error}
					</div>
				)}

				<ul className={styles.thumbnails}>
					{results.map((movie: Movie, index: number) => {
						const isLast = index === results.length - 1;

						return (
							<li key={movie.id} ref={isLast ? observerReference : null}>
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
		</div>
	);
}
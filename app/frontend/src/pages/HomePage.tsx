import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import { useSearch } from "../utils/searchContext.tsx";
import {type FiltersState, useFilters} from "../utils/filterContext.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";
import { getCurrentLang } from "../lang/i18n.tsx";

import Thumbnail from "../components/ui/Thumbnail.tsx";
import FiltersBar from "../components/ui/FiltersBar.tsx";
import { isWatched } from "../utils/watchedSession.ts";

import styles from "./HomePage.module.css";

interface Movie {
	id: number;
	archive_id: string;
	source: string;
	media_kind: string;
	title: string;
	poster_url: string | null;
	year: number | null;
	rating: number | null;
	watched: boolean;
}

interface MoviesResponse {
	results: Movie[];
	has_more: boolean;
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
					return rating / 10;
				}

				params.set("page", String(pageNum));

				if (query) params.set("query", query);

				if (filters.genreId != null) params.set("genre", String(filters.genreId));
				if (filters.minRating !== null) {
					const rating = normalizeRating(filters.minRating);
					params.set("min_rating", String(rating));
				}
				if (filters.yearFrom != null) params.set("year_from", String(filters.yearFrom));
				if (filters.yearTo != null) params.set("year_to", String(filters.yearTo));
				if (filters.sort) params.set("sort", filters.sort);
				params.set("language", getCurrentLang() === "fr" ? "fr-FR" : "en-US");

				const url = `/api/movies?${params.toString()}`;

				const token = localStorage.getItem("access_token");
				const response = await fetch(url, {
					headers: {
						"Content-Type": "application/json",
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
				});

				if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

				const data: MoviesResponse = await response.json();
				const batch = data.results ?? [];
				if (pageNum === 1) resettingRef.current = false;

				setResults((prev) => {
					const merged = isNewSearch ? batch : [...prev, ...batch];
					return Array.from(new Map(merged.map((m) => [m.archive_id, m])).values());
				});
				// Drive infinite scroll from the source-level has_more flag, not the
				// (post-filter) batch length — a rating filter emptying a page must
				// not stop the scroll while more source results remain.
				setHasMore(Boolean(data.has_more));
			} catch {
				setError(t("error"));
			} finally {
				setLoading(false);
				isFetchingRef.current = false;
			}
		},
		[filters]
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

	const handleThumbnailClick = (archiveId: string) => {
		navigate(`/movie/${archiveId}`);
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
							<li key={movie.archive_id} ref={isLast ? observerReference : null}>
								<Thumbnail
									thumbnailSrc={
										movie.poster_url
											|| (movie.source === "archive_org"
												? `https://archive.org/services/img/${movie.archive_id}`
												: undefined)
									}
									thumbnailAlt={movie.title}
									title={movie.title}
									year={movie.year ? String(movie.year) : undefined}
									rating={movie.rating ?? undefined}
									watched={movie.watched || isWatched(movie.id)}
									onClick={() => handleThumbnailClick(movie.archive_id)}
								/>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}
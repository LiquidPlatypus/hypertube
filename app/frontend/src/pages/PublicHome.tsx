import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";

import { useTranslation } from "../hooks/useTranslation.tsx";
import { getCurrentLang } from "../lang/i18n.tsx";

import Thumbnail from "../components/ui/Thumbnail.tsx";

import styles from "./HomePage.module.css";

interface Movie {
	id: number;
	archive_id: string;
	title: string;
	poster_url: string | null;
	year: number | null;
	rating: number | null;
	watched: boolean;
}

export default function HomePage() {
	const navigate = useNavigate();

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

	const loadMovies = useCallback(async (pageNum: number, isNewSearch: boolean) => {
		if (isFetchingRef.current) return;
		isFetchingRef.current = true;
		setLoading(true);
		setError(null);

		try {
			const params = new URLSearchParams();
			params.set("page", String(pageNum));
			params.set("sort", "popular");
			params.set("language", getCurrentLang() === "fr" ? "fr-FR" : "en-US");

			const url = `/api/movies?${params.toString()}`;

			const response = await fetch(url, {
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

			const data: Movie[] = await response.json();

			if (data.length === 0) {
				setHasMore(false);
			} else {
				setResults((prev) => {
					const merged = isNewSearch ? data : [...prev, ...data];
					return Array.from(new Map(merged.map((m) => [m.archive_id, m])).values());
				});
				setHasMore(true);
			}
		} catch (err) {
			setError("Erreur lors du chargement des films.");
			console.error("Error fetching movies:", err);
		} finally {
			setLoading(false);
			isFetchingRef.current = false;
		}
	}, []);

	const observerReference = useCallback(
		(node: HTMLLIElement | null) => {
			if (!node) return;
			observer.current?.disconnect();
			observer.current = new IntersectionObserver(
				(entries) => {
					const first = entries[0];
					if (first.isIntersecting && hasMore && !isFetchingRef.current) {
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

	// Chargement initial
	useEffect(() => {
		loadMovies(1, true);

		return () => observer.current?.disconnect();
	}, [loadMovies]);

	// Chargement des pages suivantes (scroll infini)
	useEffect(() => {
		if (page === 1) return;
		loadMovies(page, false);
	}, [page, loadMovies]);

	return (
		<div className={styles.content}>
			<div style={{ width: "100%" }}>
				{loading && showLoader && <div>{t("loading")}</div>}

				{error && <div>{error}</div>}

				<ul className={styles.thumbnails}>
					{results.map((movie: Movie, index: number) => {
						const isLast = index === results.length - 1;

						return (
							<li key={movie.archive_id} ref={isLast ? observerReference : null}>
								<Thumbnail
									thumbnailSrc={movie.poster_url || `https://archive.org/services/img/${movie.archive_id}`}
									thumbnailAlt={movie.title}
									title={movie.title}
									year={movie.year ? String(movie.year) : undefined}
									rating={movie.rating ?? undefined}
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
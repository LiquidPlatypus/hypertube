import * as React from "react";
import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import Textarea from "../components/ui/Textarea.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./VideoPage.module.css";

interface CastMember {
	name: string;
	character: string;
	picture_url: string | null;
}

interface Movie {
	id: number;
	archive_id: string;
	title: string;
	overview: string | null;
	poster_url: string | null;
	year: number | null;
	runtime: number | null;
	rating: number | null;
	genres: string[];
	cast: CastMember[];
	status: string;
	subtitles: string[];
}

interface Comment {
	id: number;
	content: string;
	author: string;
	author_id?: number;
	date: string;
}

interface Progress {
	progress: number;
	speed_kbs: number;
	peers: number;
	status: string;
	downloaded_mb?: number;
}

export default function VideoPage() {
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [comment, setComment] = useState("");
	const [comments, setComments] = useState<Comment[]>([]);
	const [downloadProgress, setDownloadProgress] = useState<Progress | null>(null);
	const [streamError, setStreamError] = useState(false);
	const commentFormRef = React.useRef<HTMLFormElement | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);

	const { archiveId } = useParams<{ archiveId: string }>();
	const { t } = useTranslation();

	const getMovieDetails = async (id: string) => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch(`/api/movies/${id}`, {
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
			const data: Movie = await response.json();
			setMovieDetails(data);
		} catch (err) {
			setMovieDetails(null);
			setError(t("error"));
			console.error("Error fetching movie:", err);
		} finally {
			setLoading(false);
		}
	};

	const getComments = async () => {
		const token = localStorage.getItem("access_token");
		const pageSize = 10;
		let pos = 0;
		const all: Comment[] = [];
		while (true) {
			const res = await fetch(`/api/comments?pos=${pos}`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			const json = await res.json();
			const chunk: Comment[] = json.comments ?? [];
			all.push(...chunk);
			if (chunk.length < pageSize) break;
			pos += pageSize;
		}
		all.sort((a, b) => +new Date(b.date) - +new Date(a.date));
		setComments(all);
	};

	const postComment = async (e: React.FormEvent) => {
		e.preventDefault();
		const token = localStorage.getItem("access_token");
		const res = await fetch("/api/comments", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ content: comment }),
		});
		const json = await res.json();
		setComments((prev) => [json.comment, ...prev]);
		setComment("");
	};

	// Start SSE progress once we have the DB id
	const startProgressSSE = (movieDbId: number) => {
		if (eventSourceRef.current) eventSourceRef.current.close();
		const es = new EventSource(`/api/stream/${movieDbId}/progress`);
		eventSourceRef.current = es;
		es.onmessage = (ev) => {
			try {
				const data: Progress = JSON.parse(ev.data);
				setDownloadProgress(data);
				if (data.status === "idle" || data.progress >= 100) {
					es.close();
					eventSourceRef.current = null;
					setDownloadProgress(null);
				}
			} catch {
				// ignore parse errors
			}
		};
		es.onerror = () => {
			es.close();
			eventSourceRef.current = null;
			setDownloadProgress(null);
		};
	};

	useEffect(() => {
		void getComments().catch(console.error);
	}, []);

	useEffect(() => {
		let cancelled = false;
		if (!archiveId) {
			setError(t("error.invalidID"));
			return;
		}
		setShowLoader(false);
		const loaderTimer = window.setTimeout(() => {
			if (!cancelled) setShowLoader(true);
		}, 250);
		getMovieDetails(archiveId).finally(() => {
			window.clearTimeout(loaderTimer);
			if (!cancelled) setShowLoader(false);
		});
		return () => {
			cancelled = true;
			window.clearTimeout(loaderTimer);
			eventSourceRef.current?.close();
		};
	}, [archiveId]);

	// Start SSE as soon as we know the DB id (movie might need to download)
	useEffect(() => {
		if (movieDetails?.id) {
			setStreamError(false);
			startProgressSSE(movieDetails.id);
		}
		return () => {
			eventSourceRef.current?.close();
		};
	}, [movieDetails?.id]);

	function toHoursAndMinutes(totalMinutes?: number | null) {
		if (!totalMinutes) return;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		return `${hours}h${minutes > 0 ? `${minutes}m` : ""}`;
	}

	const truncRating = movieDetails?.rating ? `${Math.trunc(movieDetails.rating * 10)}%` : "";
	// Don't set src when there's a stream error — prevents the browser retry loop
	const streamSrc = (movieDetails && !streamError) ? `/api/stream/${movieDetails.id}` : undefined;

	return (
		<div className={styles.wrapper}>
			{loading && showLoader && <div>{t("loading")}</div>}
			{error && <div>{t("error")}{error}</div>}

				<div className={styles.contentPart}>
				<div className={styles.videoPart}>
					{downloadProgress && (
						<div className={styles.downloadOverlay}>
							<span className={styles.overlaySpinner} />
							<p className={styles.overlayTitle}>
								{downloadProgress.status === "starting"
									? (t("video.preparing") || "Preparing torrent…")
									: (t("video.downloading") || "Downloading…")}
							</p>
							{downloadProgress.status !== "starting" && (
								<>
									<div className={styles.overlayBar}>
										<div
											className={styles.overlayBarFill}
											style={{ width: `${downloadProgress.progress}%` }}
										/>
									</div>
									<p className={styles.overlayMeta}>
										{downloadProgress.progress.toFixed(1)}%
										&nbsp;·&nbsp;{downloadProgress.speed_kbs} KB/s
										&nbsp;·&nbsp;{downloadProgress.peers} peer{downloadProgress.peers !== 1 ? "s" : ""}
									</p>
								</>
							)}
						</div>
					)}
					{/* Always in DOM so the browser sends the stream request (starts download) */}
					{streamError ? (
						<div className={styles.downloadOverlay}>
							<p className={styles.overlayTitle}>
								{t("video.streamError") || "Stream failed — try again"}
							</p>
							<button onClick={() => setStreamError(false)}>
								{t("video.retry") || "Retry"}
							</button>
						</div>
					) : (
						<video
							className={`${styles.video} ${downloadProgress ? styles.videoHidden : ""}`}
							src={streamSrc}
							controls
							crossOrigin="anonymous"
							onError={() => setStreamError(true)}
						>
							{movieDetails?.subtitles?.map((lang) => (
								<track
									key={lang}
									kind="subtitles"
									label={lang.toUpperCase()}
									srcLang={lang}
									src={`/api/subtitles/${movieDetails.archive_id}/${lang}`}
								/>
							))}
							<p>{t("video.error")}</p>
						</video>
					)}
				</div>
				<div className={styles.miscellaneousPart}>
					<div className={styles.mainInfos}>
						<h2>{movieDetails?.title}</h2>
						<p className={styles.summary}>{movieDetails?.overview}</p>
					</div>
					<div className={styles.rightInfos}>
						<div className={styles.meta}>
							<p>{movieDetails?.year}</p>
							<p>{toHoursAndMinutes(movieDetails?.runtime)}</p>
							<p>{truncRating}</p>
						</div>
						<div className={styles.cover}>
							<img
								src={movieDetails?.poster_url ?? undefined}
								alt={`${movieDetails?.title} Poster`}
							/>
						</div>
					</div>
				</div>

				<div className={styles.cast}>
					<h3>{t("video.casting")}</h3>
					<ul className={styles.castList}>
						{movieDetails?.cast.map((member, index) => (
							<li key={index} className={styles.actorCard}>
								{member.picture_url && (
									<img src={member.picture_url} alt={member.name} />
								)}
								<div>
									<p>{member.name}</p>
									<p>{member.character}</p>
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>

			<div className={styles.commentsPart}>
				<form ref={commentFormRef} className={styles.commentInput} onSubmit={postComment}>
					<Textarea
						placeholder={t("video.comments")}
						rows={1}
						maxLength={360}
						wrap="soft"
						variant="comment"
						size="large"
						shape="square"
						maxAutoGrowHeightPx={180}
						value={comment}
						onChange={(e) => setComment(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (comment.trim().length === 0) return;
								commentFormRef.current?.requestSubmit();
							}
						}}
						required
					/>
					<Button text={t("video.post")} size="large" shape="square" type="submit" />
				</form>

				<h2>{t("video.comments")}</h2>

				<div className={styles.commentsList}>
					{comments.map((c) => (
						<div key={c.id} className={styles.comment}>
							<h3>
								{c.author_id ? (
									<Link to={`/users/${c.author_id}`}>{c.author}</Link>
								) : (
									c.author
								)}
							</h3>
							<small>{new Date(c.date).toLocaleString()}</small>
							<p>{c.content}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

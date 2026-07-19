import * as React from "react";
import {useState, useEffect, useRef} from "react";
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
	runtime: number;
	rating: number;
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
	speed_kbs?: number;
	peers?: number;
	status: string;
	downloaded_mb?: number;
	transcoded_mb?: number;
	speed_x?: number | null;
	transcoded_sec?: number;
}

export default function VideoPage() {
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [comment, setComment] = useState("");
	const [comments, setComments] = useState<Comment[]>([]);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editContent, setEditContent] = useState("false")
	const [editSaving, setEditSaving] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState<Progress | null>(null);
	const [streamReady, setStreamReady] = useState(false);
	const [streamError, setStreamError] = useState(false);
	const [currentUsername, setCurrentUsername] = useState<string | null>(null);
	const commentFormRef = React.useRef<HTMLFormElement | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);

	const { archiveId } = useParams<{ archiveId: string }>();
	const { t } = useTranslation();

	const getMovieDetails = async (id: string) => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch(`/api/movies/${id}`, {
				headers: { "Content-Type": "application/json" },
			});

			if (!response.ok)
				throw new Error(`HTTP error! status: ${response.status}`);

			const data: Movie = await response.json();
			setMovieDetails(data);
		} catch (err) {
			setMovieDetails(null);
			setError(t("error"));
			console.error("Error fetching Movies:", err);
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
			if (!movieDetails) {
				console.warn("movieDetails empty")
				return;
			}
			const res = await fetch(`/api/comments?pos=${pos}&movie_id=${movieDetails.id}`, {
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
		if (!movieDetails) {
			console.warn("movieDetails empty")
			return;
		}

		const token = localStorage.getItem("access_token");
		const res = await fetch("/api/comments", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ content: comment, movie_id: movieDetails.id }),
		});
		const json = await res.json();
		setComments((prev) => [json.comment, ...prev]);
		setComment("");
	}

	const startEditing = (c: Comment) => {
		setEditingId(c.id);
		setEditContent(c.content);
	};

	const cancelEditing = () => {
		setEditingId(null);
		setEditContent("");
	}

	const saveEdit = async (id: number) => {
		const trimmed = editContent.trim();
		if (trimmed.length === 0 || editSaving) return;

		const token = localStorage.getItem("access_token");
		setEditSaving(true);
		try {
			const res = await fetch(`/api/comments/${id}?new_content=${encodeURIComponent(trimmed.trim())}`,
				{
					method: "PATCH",
					headers: { Authorization: `Bearer ${token}` },
				}
			);

			if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

			const json = await res.json();
			setComments((prev) =>
				prev.map((c) => (c.id === id ? { ...c, ...json.comment } : c))
			);
			setEditingId(null);
			setEditContent("");
		} catch (err) {
			console.error("Error editing comment:", err);
		} finally {
			setEditSaving(false);
		}
	};

	// Start SSE progress once we have the DB id
	const startProgressSSE = (movieDbId: number) => {
		if (eventSourceRef.current) eventSourceRef.current.close();
		const es = new EventSource(`/api/stream/${movieDbId}/progress`);
		eventSourceRef.current = es;
		es.onmessage = (ev) => {
			try {
				const data: Progress = JSON.parse(ev.data);
				if (data.status === "idle") {
					es.close();
					eventSourceRef.current = null;
					setDownloadProgress(null);
					setStreamReady(true);
				} else if (data.status === "error") {
					// Pipeline gave up (e.g. torrent source unreachable). Show the
					// error panel with a retry button instead of an empty player.
					es.close();
					eventSourceRef.current = null;
					setDownloadProgress(null);
					setStreamError(true);
				} else {
					setDownloadProgress(data);
				}
			} catch {
				// ignore parse errors
			}
		};
		es.onerror = () => {
			es.close();
			eventSourceRef.current = null;
			// Don't flip to ready on error — leave overlay up so user knows.
		};
	};

	useEffect(() => {
		// if (!movieDetails)
		// 	return
		void getComments().catch(console.error);
	}, [movieDetails]);

	React.useEffect(() => {
		let cancelled = false;

		if (!archiveId) {
			setError(t("error.invalidID"));
			return ;
		}

		// Show loader only if load time > 250ms.
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
			eventSourceRef.current?.close();;
			const v = videoRef.current;
			if (v) {
				try {
					v.pause();
					v.removeAttribute("src");
					v.load();
				} catch { /* ignore */ }
			}
		};
	}, [archiveId]);

	// Start SSE as soon as we know the DB id (movie might need to download)
	useEffect(() => {
		if (movieDetails?.id) {
			setStreamError(false);
			setStreamReady(false);
			setDownloadProgress({ status: "starting", progress: 0 });
			startProgressSSE(movieDetails.id);
		}
		return () => {
			eventSourceRef.current?.close();
		};
	}, [movieDetails?.id]);

	useEffect(() => {
		const token = localStorage.getItem("access_token");
		if (!token) return;

		fetch("/api/me", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => res.json())
			.then((data) => setCurrentUsername(data.user?.username ?? null))
			.catch(console.error);
	}, []);

	function toHoursAndMinutes(totalMinutes?: number) {
		if (totalMinutes === undefined) return ;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		return (`${hours}h${minutes > 0 ? `${minutes}m` : ''}`);
	}

	const truncRating = movieDetails ? `${Math.trunc(movieDetails.rating * 10)}%` : "";
	// Don't set src when there's a stream error — prevents the browser retry loop
	const streamSrc = (movieDetails && !streamError) ? `/api/stream/${movieDetails.id}` : undefined;

	return (
		<div className={styles.wrapper}>
			{loading && showLoader && (
				<div>
					{t("loading")}
				</div>
			)}

			{error && <div>{t("error")}{error}</div>}

			<div className={styles.contentPart}>
				<div className={styles.videoPart}>
					{streamError ? (
						<div className={styles.downloadOverlay}>
							<p className={styles.overlayTitle}>
								{t("video.streamError") || "Stream failed — try again"}
							</p>
							<button onClick={() => { setStreamError(false); setStreamReady(false); setDownloadProgress({ status: "starting", progress: 0 }); if (movieDetails?.id) startProgressSSE(movieDetails.id); }}>
								{t("video.retry") || "Retry"}
							</button>
						</div>
					) : !streamReady ? (
						<div className={styles.downloadOverlay}>
							<span className={styles.overlaySpinner} />
							<p className={styles.overlayTitle}>
								{downloadProgress?.status === "starting"
									? (t("video.preparing") || "Preparing torrent…")
									: downloadProgress?.status === "transcoding"
										? (t("video.transcoding") || "Transcoding…")
										: (t("video.downloading") || "Downloading…")}
							</p>
							{downloadProgress && downloadProgress.status !== "starting" && (
								<>
									<div className={styles.overlayBar}>
										<div
											className={styles.overlayBarFill}
											style={{ width: `${downloadProgress.progress}%` }}
										/>
									</div>
									<p className={styles.overlayMeta}>
										{downloadProgress.progress.toFixed(1)}%
										{downloadProgress.status === "transcoding"
											? (downloadProgress.speed_x != null
												? <>&nbsp;·&nbsp;{downloadProgress.speed_x}x</>
												: downloadProgress.transcoded_mb != null
													? <>&nbsp;·&nbsp;{downloadProgress.transcoded_mb} MB</>
													: null)
											: <>
												&nbsp;·&nbsp;{downloadProgress.speed_kbs ?? 0} KB/s
												&nbsp;·&nbsp;{downloadProgress.peers ?? 0} peer{(downloadProgress.peers ?? 0) !== 1 ? "s" : ""}
											</>}
									</p>
								</>
							)}
						</div>
					) : (
						<video
							ref={videoRef}
							className={styles.video}
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
						onChange={e => setComment(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								if (comment.trim().length === 0) return;
								commentFormRef.current?.requestSubmit();
							}
						}}
						required
					/>
					<Button
						text={t("video.post")}
						size="large"
						shape="square"
						type="submit"
					/>
				</form>

				<h2>{t("video.comments")}</h2>

				<div className={styles.commentsList}>
					{comments.map((c) => (
						<div key={c.id} className={styles.comment}>
							<h3 className={styles.commentHeader}>
								<Link
									to={
										c.author === currentUsername
											? "/profile"
											: `/users/${encodeURIComponent(c.author)}`
									}
								>
									{c.author}
								</Link>
								{c.author === currentUsername && editingId !== c.id && (
									<button
										type="button"
										className={styles.editTrigger}
										onClick={() => startEditing(c)}
									>
										{t("video.edit") || "Edit"}
									</button>
								)}
							</h3>
							<small>{new Date(c.date).toLocaleString()}</small>

							{editingId === c.id ? (
								<div className={styles.editForm}>
									<Textarea
										rows={1}
										maxLength={360}
										wrap="soft"
										variant="comment"
										size="large"
										shape="square"
										maxAutoGrowHeightPx={180}
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter" && !e.shiftKey) {
												e.preventDefault();
												void saveEdit(c.id);
											} else if (e.key === "Escape") {
												cancelEditing();
											}
										}}
										autoFocus
									/>
									<div className={styles.editActions}>
										<Button
											text={editSaving ? (t("video.saving") || "Saving…") : (t("video.save") || "Save")}
											size="large"
											shape="square"
											onClick={() => void saveEdit(c.id)}
											disabled={editSaving || editContent.trim().length === 0}
										/>
										<Button
											text={t("video.cancel") || "Cancel"}
											size="large"
											shape="square"
											onClick={cancelEditing}
										/>
									</div>
								</div>
							) : (
								<p>{c.content}</p>
							)}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
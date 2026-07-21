import * as React from "react";
import {useState, useEffect, useRef} from "react";
import { useParams, Link } from "react-router-dom";
import Hls from "hls.js";

import Button from "../components/ui/Button.tsx";
import Textarea from "../components/ui/Textarea.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";
import { markWatched } from "../utils/watchedSession.ts";

import styles from "./VideoPage.module.css";

interface CastMember {
	name: string;
	character: string;
	picture_url: string | null;
}

interface VideoFile {
	index: number;
	name: string;
	size: number;
}

interface Movie {
	id: number;
	archive_id: string;
	source: string;
	media_kind: string;
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
	files: VideoFile[];
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
	segments?: number;
	// Server hint: "hls" → play the growing segment playlist, "direct" → the
	// file is complete/native, play it straight with Range seeking.
	mode?: "hls" | "direct";
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
	const [activeSubtitle, setActiveSubtitle] = useState<string | null>(null);
	const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false);
	// Subtitles arrive asynchronously (OpenSubtitles / extraction), so track them
	// in their own state refreshed by polling — the CC menu updates without reload.
	const [subtitles, setSubtitles] = useState<string[]>([]);
	// Chosen file inside a multi-file (academic) torrent; null → server auto-picks.
	const [selectedFile, setSelectedFile] = useState<number | null>(null);
	// While downloading we play the progressively-produced HLS segments (playback
	// can start after the first ~2s segment). Once the file is fully on disk we
	// switch to the plain file endpoint: real Range seeking over the whole movie.
	const [sourceMode, setSourceMode] = useState<"hls" | "direct">("hls");
	const hlsRef = useRef<Hls | null>(null);
	const commentFormRef = React.useRef<HTMLFormElement | null>(null);
	const eventSourceRef = useRef<EventSource | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	// Guards the one-shot reload to the complete (seekable) file once downloaded.
	const fullReloadedRef = useRef(false);
	const subtitleControlRef = useRef<HTMLDivElement | null>(null);

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
			setSubtitles(data.subtitles ?? []);
		} catch {
			setMovieDetails(null);
			setError(t("error"));
		} finally {
			setLoading(false);
		}
	};

	// Build the stream/progress query string, carrying the chosen file (if any).
	const fileParam = (prefix: "?" | "&") =>
		selectedFile !== null ? `${prefix}file=${selectedFile}` : "";

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
			const res = await fetch(`/api/comment?pos=${pos}&movie_id=${movieDetails.id}`, {
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
		const es = new EventSource(`/api/stream/${movieDbId}/progress${fileParam("?")}`);
		eventSourceRef.current = es;
		es.onmessage = (ev) => {
			try {
				const data: Progress = JSON.parse(ev.data);
				if (data.status === "idle") {
					es.close();
					eventSourceRef.current = null;
					setDownloadProgress(null);
					if (data.mode) setSourceMode(data.mode);
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
		void getComments().catch(console.error);
	}, [movieDetails]);

	useEffect(() => {
		if (!movieDetails) return;
		// Badge "vu": immediate session feedback (persisted per-user server-side below).
		markWatched(movieDetails.id);
		// Per-user watched + retention clock: POST /watch. GET /movies/:id stays
		// side-effect-free (RESTful) — the mutation lives here, not in the GET.
		const token = localStorage.getItem("access_token");
		void fetch(`/api/movies/${movieDetails.id}/watch`, {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
		}).catch(() => { /* non-critical */ });
	}, [movieDetails?.id]);

	// While the torrent is still downloading, playback runs off the growing
	// fragmented MP4, which only exposes what has been transcoded so far (a 90 min
	// film shows as ~10 min). Once the whole file is on disk the server can serve
	// it with a real Content-Length — full duration + seeking. Poll for that and
	// reload the player once, restoring the current position so playback isn't cut.
	useEffect(() => {
		if (!movieDetails?.id || !streamReady || fullReloadedRef.current) return;
		const id = movieDetails.id;
		let stop = false;
		const timer = window.setInterval(async () => {
			if (stop || fullReloadedRef.current) return;
			try {
				const res = await fetch(`/api/stream/${id}/ready`);
				const json = await res.json();
				if (!json?.downloaded) return;
				fullReloadedRef.current = true;
				window.clearInterval(timer);
				const v = videoRef.current;
				if (!v) return;
				const at = v.currentTime;
				const wasPlaying = !v.paused;
				// The whole file is on disk now: drop HLS and switch to the plain
				// file endpoint, which serves real Range requests → full duration
				// and seeking anywhere instead of only the produced segments.
				if (hlsRef.current) {
					hlsRef.current.destroy();
					hlsRef.current = null;
				}
				setSourceMode("direct");
				v.src = `/api/stream/${id}?complete=1${fileParam("&")}`;
				v.load();
				v.addEventListener(
					"loadedmetadata",
					() => {
						try {
							if (at > 0) v.currentTime = at;
							if (wasPlaying) void v.play();
						} catch { /* ignore */ }
					},
					{ once: true },
				);
			} catch { /* keep polling */ }
		}, 5000);
		return () => {
			stop = true;
			window.clearInterval(timer);
		};
	}, [movieDetails?.id, streamReady]);

	React.useEffect(() => {
		let cancelled = false;

		if (!archiveId) {
			setError(t("error.invalidID"));
			return ;
		}

		// Show loader only if load time > 250ms.
		setShowLoader(false);
		setActiveSubtitle(null);
		setSubtitleMenuOpen(false);
		setSelectedFile(null);
		setSubtitles([]);
		setSourceMode("hls");
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
			if (hlsRef.current) {
				hlsRef.current.destroy();
				hlsRef.current = null;
			}
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

	// Start SSE as soon as we know the DB id (movie might need to download), and
	// restart it whenever the user picks a different file in a multi-file bundle.
	useEffect(() => {
		if (movieDetails?.id) {
			setStreamError(false);
			setStreamReady(false);
			fullReloadedRef.current = false;
			setDownloadProgress({ status: "starting", progress: 0 });
			startProgressSSE(movieDetails.id);
		}
		return () => {
			eventSourceRef.current?.close();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [movieDetails?.id, selectedFile]);

	// Attach hls.js while streaming the growing HLS playlist. Chrome/Firefox have
	// no native HLS, so hls.js is required; Safari can play the playlist directly.
	// Any fatal error falls back to the progressive (fMP4) endpoint.
	useEffect(() => {
		const video = videoRef.current;
		if (!video || !movieDetails?.id || !streamReady || streamError) return;
		if (sourceMode !== "hls") return;

		const url = `/api/stream/${movieDetails.id}/hls/index.m3u8${fileParam("?")}`;

		if (video.canPlayType("application/vnd.apple.mpegurl")) {
			video.src = url;
			return;
		}
		if (!Hls.isSupported()) {
			setSourceMode("direct");
			return;
		}

		// Segments are transcoded on demand, so a fragment can legitimately take
		// a few seconds (fetch the torrent pieces, then encode the slice). The
		// default 20s timeout would report a fatal error on a healthy stream.
		// Buffer length is capped so seeking doesn't queue up dozens of
		// simultaneous segment transcodes ahead of the playhead.
		const hls = new Hls({
			enableWorker: true,
			lowLatencyMode: false,
			manifestLoadingTimeOut: 60000,
			levelLoadingTimeOut: 60000,
			fragLoadingTimeOut: 120000,
			fragLoadingMaxRetry: 6,
			maxBufferLength: 20,
			maxMaxBufferLength: 40,
		});
		hlsRef.current = hls;
		hls.loadSource(url);
		hls.attachMedia(video);
		hls.on(Hls.Events.ERROR, (_evt, data) => {
			if (!data.fatal) return;
			if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
				hls.startLoad();
			} else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
				hls.recoverMediaError();
			} else {
				hls.destroy();
				hlsRef.current = null;
				setSourceMode("direct");
			}
		});

		return () => {
			hls.destroy();
			hlsRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [movieDetails?.id, streamReady, streamError, sourceMode, selectedFile]);

	// Subtitles are acquired asynchronously server-side (OpenSubtitles + extraction)
	// after the detail load, so poll a few times and refresh the CC list in place.
	useEffect(() => {
		if (!movieDetails?.id) return;
		const id = movieDetails.id;
		let attempts = 0;
		let stop = false;
		const timer = window.setInterval(async () => {
			if (stop) return;
			attempts += 1;
			try {
				const res = await fetch(`/api/movies/${id}/subtitles`);
				const json = await res.json();
				const list: string[] = json.subtitles ?? [];
				setSubtitles((prev) => (list.length !== prev.length ? list : prev));
			} catch { /* keep trying */ }
			if (attempts >= 8) window.clearInterval(timer);
		}, 4000);
		return () => {
			stop = true;
			window.clearInterval(timer);
		};
	}, [movieDetails?.id]);

	// Keep the <video>'s text tracks in sync with the subtitle menu selection.
	useEffect(() => {
		const tracks = videoRef.current?.textTracks;
		if (!tracks) return;
		for (let i = 0; i < tracks.length; i++) {
			const track = tracks[i];
			track.mode = track.language === activeSubtitle ? "showing" : "hidden";
		}
	}, [activeSubtitle, subtitles, streamReady]);

	// Close the subtitle popup on outside click.
	useEffect(() => {
		if (!subtitleMenuOpen) return;
		const handleClick = (e: MouseEvent) => {
			if (subtitleControlRef.current && !subtitleControlRef.current.contains(e.target as Node)) {
				setSubtitleMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [subtitleMenuOpen]);

	useEffect(() => {
		const token = localStorage.getItem("access_token");
		if (!token) return;

		fetch("/api/me", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((res) => res.json())
			.then((data) => setCurrentUsername(data.user?.username ?? null))
			.catch(() => { /* username is cosmetic */ });
	}, []);

	function toHoursAndMinutes(totalMinutes?: number) {
		if (totalMinutes === undefined) return ;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		return (`${hours}h${minutes > 0 ? `${minutes}m` : ''}`);
	}

	const truncRating = movieDetails ? `${Math.trunc(movieDetails.rating * 10)}%` : "";
	// Don't set src when there's a stream error — prevents the browser retry loop.
	// In HLS mode hls.js drives the element, so the src attribute stays empty.
	const streamSrc =
		movieDetails && !streamError && sourceMode === "direct"
			? `/api/stream/${movieDetails.id}${fileParam("?")}`
			: undefined;
	const videoFiles = movieDetails?.files ?? [];

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
											? <>
												&nbsp;·&nbsp;{downloadProgress.segments ?? 0} seg.
											</>
											: <>
												&nbsp;·&nbsp;{downloadProgress.speed_kbs ?? 0} KB/s
												&nbsp;·&nbsp;{downloadProgress.peers ?? 0} peer{(downloadProgress.peers ?? 0) !== 1 ? "s" : ""}
											</>}
									</p>
								</>
							)}
						</div>
					) : (
						<div className={styles.videoWrap}>
							{videoFiles.length > 1 && (
								<select
									className={styles.fileSelect}
									value={selectedFile ?? videoFiles[0].index}
									onChange={(e) => setSelectedFile(Number(e.target.value))}
								>
									{videoFiles.map((f) => (
										<option key={f.index} value={f.index}>{f.name}</option>
									))}
								</select>
							)}
							<video
								ref={videoRef}
								className={styles.video}
								src={streamSrc}
								controls
								crossOrigin="anonymous"
								onError={() => setStreamError(true)}
							>
								{subtitles.map((lang) => (
									<track
										key={lang}
										kind="subtitles"
										label={lang.toUpperCase()}
										srcLang={lang}
										src={`/api/subtitles/${movieDetails?.archive_id}/${lang}`}
									/>
								))}
								<p>{t("video.error")}</p>
							</video>

							<div className={styles.subtitleControl} ref={subtitleControlRef}>
								<button
									type="button"
									className={styles.subtitleToggleBtn}
									aria-label={t("video.subtitles")}
									aria-expanded={subtitleMenuOpen}
									onClick={() => setSubtitleMenuOpen((open) => !open)}
								>
									CC
								</button>
								{subtitleMenuOpen && (
									<div className={styles.subtitleMenu}>
										{subtitles.length > 0 ? (
											<>
												<button
													type="button"
													className={activeSubtitle === null ? styles.subtitleMenuItemActive : styles.subtitleMenuItem}
													onClick={() => { setActiveSubtitle(null); setSubtitleMenuOpen(false); }}
												>
													{t("video.subtitlesOff")}
												</button>
												{subtitles.map((lang) => (
													<button
														key={lang}
														type="button"
														className={activeSubtitle === lang ? styles.subtitleMenuItemActive : styles.subtitleMenuItem}
														onClick={() => { setActiveSubtitle(lang); setSubtitleMenuOpen(false); }}
													>
														{lang.toUpperCase()}
													</button>
												))}
											</>
										) : (
											<p className={styles.subtitleMenuEmpty}>{t("video.noSubtitles")}</p>
										)}
									</div>
								)}
							</div>
						</div>
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
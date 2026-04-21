import * as React from "react";
import {useState, useEffect} from "react";
import { useParams, Link } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import Textarea from "../components/ui/Textarea.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./VideoPage.module.css";

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

interface Comment {
	id: number;
	content: string;
	author: string;
	author_id?: number;
	date: string;
}

export default function VideoPage() {
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [comment, setComment] = useState("");
	const [comments, setComments] = useState<Comment[]>([]);
	const commentFormRef = React.useRef<HTMLFormElement | null>(null);
	const { id } = useParams<{ id: string }>();

	const { t } = useTranslation();

	const getMovieDetails = async (movieId: number) => {
		setLoading(true);
		setError(null);

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
	}

	useEffect(() => {
		void getComments().catch(console.error);
	}, []);

	React.useEffect(() => {
		let cancelled = false;

		if (!id) {
			setError(t("error.invalidID"));
			return ;
		}

		// Show loader only if load time > 250ms.
		setShowLoader(false);
		const loaderTimer = window.setTimeout(() => {
			if (!cancelled) setShowLoader(true);
		}, 250);

		getMovieDetails(parseInt(id, 10)).finally(() => {
			window.clearTimeout(loaderTimer);
			if (!cancelled) setShowLoader(false);
		});

		return () => {
			cancelled = true;
			window.clearTimeout(loaderTimer);
		};
	}, [id]);

	function toHoursAndMinutes(totalMinutes?: number) {
		if (totalMinutes === undefined) return ;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		return (`${hours}h${minutes > 0 ? `${minutes}m` : ''}`);
	}

	const truncRating = movieDetails ? `${Math.trunc(movieDetails.score * 10)}%` : "";

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
					<video
						className={styles.video}
						src="/videos/screen2.mp4"
						controls
					>
						<p>{t("video.error")}</p>
					</video>
				</div>
				<div className={styles.miscellaneousPart}>
					<div className={styles.mainInfos}>
						<h2>{movieDetails?.title}</h2>
						<p className={styles.summary}>
							{movieDetails?.overview}
						</p>
					</div>
					<div className={styles.rightInfos}>
						<div className={styles.meta}>
							<p>{movieDetails?.release_date}</p>
							<p>{toHoursAndMinutes(movieDetails?.runtime)}</p>
							<p>{truncRating}</p>
						</div>
						<div className={styles.cover}>
							<img
								src={movieDetails?.poster_path}
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
								<img
									src={member.actor_picture_path}
									alt={member.actor_name}
								/>
								<div>
									<p>{member.actor_name}</p>
									<p>{member.character_name}</p>
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
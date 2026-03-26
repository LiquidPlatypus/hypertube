import * as React from "react";
import {useState, useCallback, useEffect} from "react";
import { useParams } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./WIPVideo.module.css";

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
	date: Date;
}

export default function WIPVideo() {
	const [loading, setLoading] = useState(false);
	const [showLoader, setShowLoader] = useState(false);
	const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [comment, setComment] = useState("");
	const [comments, setComments] = useState<Comment[]>([]);
	const [chunk, setChunk] = useState(0);
	const [isEmpty, setIsEmpty] = useState<boolean>(false);
	const observer = React.useRef<IntersectionObserver | null>(null);
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
		const res = await fetch("/api/comments?pos=0", {
			headers: { Authorization: `Bearer ${token}` },
		});
		const json = await res.json();
		setComments(json.comments ?? []);
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

	const observerTrigger = async () => {
		if (loading)
			return ;
		setChunk(chunk + 10);
		await getComments();
	}

	const lastComment = useCallback((node: HTMLDivElement) => {
		if (loading) return;
		if (observer.current) observer.current.disconnect();

		observer.current = new IntersectionObserver(entries => {
			if (entries[0].isIntersecting && !isEmpty) {
				observerTrigger();
			}
		});
		if (node) observer.current.observe(node);
	}, [loading, isEmpty]);

	useEffect(() => {
		getComments();
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
				<form className={styles.commentInput} onSubmit={postComment}>
					<Input
						type="text"
						placeholder={t("video.comments")}
						value={comment}
						variant="comment"
						onChange={(e) => setComment(e.target.value)}
						size="large"
						shape="square"
						required
					/>
					<Button
						size="large"
						shape="square"
						type="submit"
					/>
				</form>

				<h2>{t("video.comments")}</h2>

				<div className={styles.commentsList}>
					{comments.map((c) => (
						<div key={c.id} className={styles.comment}>
							<h3>{c.author}</h3>
							<p>{c.content}</p>
							<small>{new Date(c.date).toLocaleString()}</small>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
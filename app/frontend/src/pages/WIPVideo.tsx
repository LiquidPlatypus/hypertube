import * as React from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

type ApiComment = {
	id?: number;
	username?: string;
	pseudo?: string;
	author?: string;
	user?: string;
	content?: string;
	text?: string;
	created_at?: string;
};

export default function WIPVideo() {
	const navigate = useNavigate();
	const [Loading, setLoading] = useState(false);
	const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
	const [error, setError] = useState("");

	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();

	// Commentaires
	const [userComment, setUserComment] = useState("");
	const [comments, setComments] = useState<ApiComment[]>([]);
	const [commentLoading, setCommentLoading] = useState(false);
	const [commentError, setCommentError] = useState("");

	const getMovieDetails = async (movieId: number) => {
		setLoading(true);
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
			setError("Erreur lors de la récupération du film.");
			console.error("Error fetching movie:", err);
		}
		setLoading(false);
	};

	const loadComments = async () => {
		setCommentLoading(true);
		setCommentError("");

		try {
			const token = localStorage.getItem("access_token");
			const res = await fetch("/api/comments", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
			});

			if (!res.ok) throw new Error(`HTTP error ${res.status}`);
			const data = await res.json();
			console.log("COMMENTS API:", data);
			setComments(data.comments ?? []);
		} catch (e) {
			console.error("Error loading comments:", e);
			setCommentError("Impossible de charger les commentaires.");
		} finally {
			setCommentLoading(false);
		}
	};

	const submitComment = async () => {
		if (!userComment.trim()) return;

		try {
			const token = localStorage.getItem("access_token");
			const res = await fetch("/api/comments", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ content: userComment }),
			});

			if (!res.ok) throw new Error(`HTTP error ${res.status}`);

			setUserComment("");
			await loadComments();
		} catch (e) {
			console.error("Error posting comment:", e);
			setCommentError("Impossible d’envoyer le commentaire.");
		}
	};

	React.useEffect(() => {
		if (id) {
			getMovieDetails(parseInt(id, 10));
			loadComments();
		} else {
			setError("ID de film invalide.");
		}
	}, [id]);

	function toHoursAndMinutes(totalMinutes: number | undefined) {
		const hours = Math.floor((totalMinutes ?? 0) / 60);
		const minutes = (totalMinutes ?? 0) % 60;

		return `${hours}h${minutes > 0 ? `${minutes}m` : ""}`;
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.contentPart}>
				<div className={styles.videoPart}>
					<video className={styles.video} src="/videos/santa.mp4" controls>
						<p>{t("video.error")}</p>
					</video>
				</div>

				<div className={styles.miscellaneousPart}>
					<div className={styles.mainInfos}>
						<h2>{movieDetails?.title}</h2>
						<p className={styles.summary}>{movieDetails?.overview}</p>
					</div>

					<div className={styles.rightInfos}>
						<div className={styles.meta}>
							<p>{movieDetails?.release_date}</p>
							<p>{toHoursAndMinutes(movieDetails?.runtime)}</p>
							<p>{movieDetails ? `${Math.trunc(movieDetails.score * 10)}%` : ""}</p>
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
				<div className={styles.commentInput}>
					<Input
						type="text"
						placeholder={t("video.comments")}
						value={userComment}
						variant="comment"
						onChange={(e) => setUserComment(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") submitComment();
						}}
						size="large"
						shape="square"
						required
					/>
					<Button
						size="large"
						shape="square"
						text="SEND"
						className={styles.retroSend}
						onClick={submitComment}
					/>


				</div>

				<h2>{t("video.comments")}</h2>

				{commentLoading && <p>Chargement...</p>}
				{commentError && <p>{commentError}</p>}

				<div className={styles.commentsList}>
					{comments.map((comment, idx) => {
						const author =
							comment.username ??
							comment.pseudo ??
							comment.author ??
							comment.user ??
							"Anonymous";

						const content =
							comment.content ??
							comment.text ??
							"";

						return (
							<div key={comment.id ?? idx} className={styles.comment}>
								<h3>{author}</h3>
								<p>{content}</p>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}

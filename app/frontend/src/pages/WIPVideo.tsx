import * as React from "react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./WIPVideo.module.css";

const comments = [
	{ id: 1, pseudo: "Pseudo", text: "fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" },
	{ id: 2, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 3, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 4, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 5, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 6, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 7, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 8, pseudo: "Pseudo", text: "ffffffffffffffffffffffffff ffffffffffffffffffffffffffffff" },
	{ id: 9, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 10, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 11, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 12, pseudo: "Pseudo", text: "ffffffffffffffffffffffffffffffffffffffffffffffffff" },
	{ id: 13, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 14, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 15, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 16, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 17, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 18, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 19, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 20, pseudo: "Pseudo", text: "fffffffffff" },
]

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

export default function WIPVideo() {
	const navigate = useNavigate();
	const [Loading, setLoading] = useState(false);
	const [movieDetails, setMovieDetails] = useState<Movie | null>(null);
	const [error, setError] = useState('');
	const { id } = useParams<{ id: string }>();

	const { t } = useTranslation();

	const [userComment, setUserComment] = useState("");

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
				throw new Error(`HTTP eroror! status: ${response.status}`);
			}
			const data: Movie = await response.json();
			console.log(data);
			setMovieDetails(data);
		} catch (err) {
			setError('Erreur lors de la recherche des films.');
			console.error("Error fetching Movies:", err);
		}
		setLoading(false);
	}

	React.useEffect(() => {
		if (id) {
			getMovieDetails(parseInt(id, 10));
		} else {
			setError("ID de film invalide.");
		}
	}, [navigate]);

	function toHoursAndMinutes(totalMinutes: number | undefined) {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		return (`${hours}h${minutes > 0 ? `${minutes}m` : ''}`);
	}

	return (
		<div className={styles.wrapper}>
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
							<p>{`${Math.trunc(movieDetails?.score * 10)}%`}</p>
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
						size="large"
						shape="square"
						required
					/>
					<Button
						size="large"
						shape="square"
					/>
				</div>

				<h2>{t("video.comments")}</h2>

				<div className={styles.commentsList}>
					{comments.map((comment) => (
						<div key={comment.id} className={styles.comment}>
							<h3>{comment.pseudo}</h3>
							<p>{comment.text}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
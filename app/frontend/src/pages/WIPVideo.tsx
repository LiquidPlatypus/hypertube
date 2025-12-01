import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./WIPVideo.module.css";

const comments = [
	{ id: 1, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 2, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 3, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 4, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 5, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 6, pseudo: "Pseudo", text: "fffffffffff" },
	{ id: 7, pseudo: "Pseudo", text: "fffffffffff" }
]

export default function WIPVideo() {
	const { t } = useTranslation();

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
						<h2>TITLE</h2>
						<h3>{t("video.summary")}</h3>
						<p className={styles.summary}>
							tres long resumetres long resumetres long resumetres
							long resumetres long resume tres long resumetres
							long resumetres long resumetres long resumetres long
							resume tres long resumetres long resumetres long
							resumetres long resumetres long resume
						</p>
					</div>
					<div className={styles.cast}>
						<ul>
							<li>{t("video.casting")}</li>
						</ul>
					</div>
					<div className={styles.rightInfos}>
						<div className={styles.meta}>
							<p>year</p>
							<p>lenght</p>
							<p>grade</p>
						</div>
						<div className={styles.cover}>
							<img
								src="/assets/Vertical_placeholder.svg"
								alt="cover"
							/>
						</div>
					</div>
				</div>
			</div>

			<div className={styles.commentsPart}>
				{comments.map((comment) => (
					<div key = {comment.id}>
						<h3>{comment.pseudo}</h3>
						<p>{comment.text}</p>
					</div>
				))}
			</div>
		</div>
	);
}
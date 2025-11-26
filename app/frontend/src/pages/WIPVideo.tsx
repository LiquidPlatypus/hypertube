import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./WIPVideo.module.css";

export default function WIPVideo() {
	const { t } = useTranslation();

	return (
		<div className={styles.wrapper}>
			<div className={styles.contentPart}>
				<div className={styles.videoPart}>
					// TODO : MESSAGE SI LA VIDÉO NE FONCTIONNE PAS
					<video
						className={styles.video}
						src="/videos/screen2.mp4"
						controls
					/>
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

			<div className={styles.commentsPart}>
				<h2>{t("video.comments")}</h2>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
				<p>fffffffffff</p>
			</div>
		</div>
	);
}
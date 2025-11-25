import styles from "./WIPVideo.module.css";

export default function WIPVideo() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.videoPart}>
				<video
					className={styles.BackgroundVideo}
					src="/videos/screen2.mp4"
					playsInline
				/>
			</div>
			<div className={styles.commentsPart}>

			</div>
		</div>
	);
}
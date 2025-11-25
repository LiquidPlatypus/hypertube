import styles from "./WIPVideo.module.css";

export default function WIPVideo() {
	return (
		<div className={styles.wrapper}>
			<div className={styles.contentPart}>
				<div className={styles.videoPart}>
					<video
						className={styles.video}
						src="/videos/screen2.mp4"
						height="500"
						width="800"
						playsInline
					/>
				</div>
				<div className={styles.miscellaneousPart}>
					<h2>TITLE</h2>
					<p>Summary</p>
					<ul>
						<li>casting</li>
					</ul>
					<p>year</p>
					<p>lenght</p>
					<p>grade</p>
					<img alt="cover"/>
				</div>
			</div>

			<div className={styles.commentsPart}>
				<h3>Comments</h3>
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
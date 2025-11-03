import styles from "./HomePage.module.css";

import testThumbnail from "../../public/videos/screen2.mp4";

const thumbnailsTest: Array<string> = Array(9).fill(testThumbnail);

export default function HomePage() {
	const listThumbnailsTest: JSX.Element[] = thumbnailsTest.map(
		(path, index) => (
			<li key={index}>
				<video
					src="/videos/screen2.mp4" // tu peux mettre n'importe quelle vidéo temporaire
					autoPlay
					loop
					muted
					className={styles.TMPVideo}
				/>
			</li>
		),
	);

	return (
		<div className={styles.tmp}>
			<ul className={styles.thumbnails}>{listThumbnailsTest}</ul>
		</div>
	);
}
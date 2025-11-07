import type { JSX } from "react";

import styles from "./HomePage.module.css";

import testThumbnail from "/assets/elementor-placeholder-image.png";

const thumbnailsTest: Array<string> = Array(20).fill(testThumbnail);

export default function HomePage() {
	const listThumbnailsTest: JSX.Element[] = thumbnailsTest.map(
		(path, index) => (
			<li key={index}>
				<img src={path} alt={`Thumbnail ${index + 1}`} />
			</li>
		),
	);

	return (
		<div className={styles.content}>
			<ul className={styles.thumbnails}>{listThumbnailsTest}</ul>
		</div>
	);
}
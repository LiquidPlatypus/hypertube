import type { JSX } from "react";

import styles from "./HomePage.module.css";

import testThumbnail from "/assets/elementor-placeholder-image.png";

const thumbnailsTest: Array<string> = Array(100).fill(testThumbnail);

export default function HomePage() {
	const listThumbnailsTest: JSX.Element[] = thumbnailsTest.map(
		(path, index) => (
			<li key={index}>
				<img src={path} alt={`Thumbnail ${index + 1}`} />
				<div className={styles.Infos}>
					<h1>Title</h1>
					<p>Year</p>
					<p>90%</p>
					<img className={styles.Cover} src="/assets/elementor-placeholder-image.png" alt="Cover"/>
				</div>
			</li>
		),
	);

	return (
		<div className={styles.content}>
			<ul className={styles.thumbnails}>{listThumbnailsTest}</ul>
		</div>
	);
}
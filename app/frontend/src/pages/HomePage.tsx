import type { JSX } from "react";

import styles from "./HomePage.module.css";

import testThumbnail from "/assets/elementor-placeholder-image.png";
import Thumbnail from "../components/ui/Thumbnail.tsx";

const thumbnailsTest: Array<string> = Array(100).fill(testThumbnail);

export default function HomePage() {
	const listThumbnailsTest: JSX.Element[] = thumbnailsTest.map(
		(path, index) => (
			<li key={index}>
				<Thumbnail thumbnailSrc={path} thumbnailAlt={`Thumbnail ${index + 1}`} />
			</li>
		),
	);

	return (
		<div className={styles.content}>
			<ul className={styles.thumbnails}>{listThumbnailsTest}</ul>
		</div>
	);
}
import styles from "./MainLayout.module.css";
import type { JSX } from "react";

import testImage from "../../assets/test/sddefault.jpg";

const thumbnailsTest: Array<string> = Array(9).fill(testImage);

export default function MainLayout() {
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

import styles from "./MainLayout.module.css";
import type { JSX } from "react";

const thumbnailsTest: Array<string> = [
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
	"src/assets/test/Fw5IdJVWAAAc-c2.jpg",
];

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

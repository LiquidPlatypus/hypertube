import type { JSX } from "react";

import styles from "./HomePage.module.css";

import testThumbnail from "/assets/elementor-placeholder-image.png";
import RetroTvFrame from "../components/TVFrame.tsx";

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
		<div className={styles.TVWrapper}>
			<RetroTvFrame
				tvImageSrc="/assets/TV4.png"
				videoSrc="/videos/screen2.mp4"
				tvWidth={1920}
				tvHeight={1080}
				screenX={560}
				screenY={245}
				screenWidth={1100}
				screenHeight={500}
				contentScale={1}
			>
				<div className={styles.content}>
					<ul className={styles.thumbnails}>{listThumbnailsTest}</ul>
				</div>
			</RetroTvFrame>
		</div>
	);
}
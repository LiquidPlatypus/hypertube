import { useNavigate } from "react-router-dom";

import Thumbnail from "../components/ui/Thumbnail.tsx";

import styles from "./HomePage.module.css";

import testThumbnail from "/assets/vertical_cover.webp";

const thumbnailsTest = Array.from({ length: 35 }, (_, i) => ({
	src: testThumbnail,
	title: `Film ${i + 1}`,
	year: 2000 + (i % 20),
	rating: (60 + Math.random() * 3).toFixed(0),
}));

export default function HomePage() {
	const navigate = useNavigate();

	const handleThumbnailClick = () => {
		navigate("/WIPVideo");
	};

	return (
		<div className={styles.content}>
			<ul className={styles.thumbnails}>
				{thumbnailsTest.map((thumb, index) => (
					<li key={index}>
						<Thumbnail
							thumbnailSrc={thumb.src}
							thumbnailAlt={`Thumbnail ${index + 1}`}
							title={thumb.title}
							year={thumb.year}
							rating={thumb.rating}
							onClick={() => handleThumbnailClick()}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
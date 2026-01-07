import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSearch } from "../utils/searchContext.tsx";

import Thumbnail from "../components/ui/Thumbnail.tsx";

import styles from "./HomePage.module.css";

interface Movie {
	id: number;
	title: string;
	poster_path: string;
	release_date: string;
	score: number;
}

export default function HomePage() {
	const navigate = useNavigate();

	const { searchTerm } = useSearch();
	const [results, setResults] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const fetchData = async () => {
			setLoading(true);
			const url = searchTerm
				? `/api/thumbnails?query=${encodeURIComponent(searchTerm)}`
				: `/api/thumbnails`;

			const res = await fetch(url);
			const data = await res.json();
			setResults(data);
			setLoading(false);
		};

		fetchData();
	}, [searchTerm]);

	const handleThumbnailClick = () => {
		navigate("/WIPVideo");
	};

	return (
		<div className={styles.content}>
			<ul className={styles.thumbnails}>
				{results.map((movie) => (
					<li key={movie.id}>
						<Thumbnail
							thumbnailSrc={movie.poster_path}
							thumbnailAlt={movie.title}
							title={movie.title}
							year={movie.release_date}
							rating={movie.score}
							onClick={() => handleThumbnailClick()}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}
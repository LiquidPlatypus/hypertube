import { useState } from "react";
import styles from "./Thumbnail.module.css";

interface ThumbnailProps {
	thumbnailSrc: string;
	thumbnailAlt: string;
	title: string;
	year?: string;
	rating?: number;
	onClick?: () => void;
}

export default function Thumbnail({
	thumbnailSrc,
	thumbnailAlt,
	title,
	year,
	rating,
	onClick,
}: ThumbnailProps) {
	const [imgState, setImgState] = useState<"loading" | "loaded" | "error">("loading");

	const truncRating = rating !== undefined ? Math.trunc(rating * 10) : undefined;

	return (
		<div className={styles.Thumbnail} onClick={onClick}>
			<div className={styles.CoverWrapper}>
				{imgState !== "loaded" && (
					<div className={styles.Placeholder}>
						{imgState === "loading" && <span className={styles.Spinner} />}
					</div>
				)}
				<img
					src={thumbnailSrc}
					alt={thumbnailAlt}
					loading="lazy"
					className={`${styles.Image} ${imgState === "loaded" ? styles.ImageVisible : styles.ImageHidden}`}
					onLoad={() => setImgState("loaded")}
					onError={() => setImgState("error")}
				/>
			</div>

			<div className={styles.Infos}>
				<h3 className={styles.Title}>{title}</h3>
				<div className={styles.Meta}>
					{year && <span className={styles.Year}>📅 {year}</span>}
					{truncRating !== undefined && (
						<span className={styles.Rating}>⭐ {truncRating}%</span>
					)}
				</div>
			</div>
		</div>
	);
}

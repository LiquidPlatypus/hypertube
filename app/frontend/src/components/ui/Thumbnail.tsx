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

	// Ajusté sur 100 et tronqué à la virgule.
	const truncRating = rating !== undefined ? Math.trunc(rating * 10) : undefined;

	return (
		<div className={styles.Thumbnail} onClick={onClick} >
			<div className={styles.CoverWrapper}>
				<img
					src={thumbnailSrc || "/assets/image-placeholder-vertical.jpg"}
					alt={thumbnailAlt}
					loading="lazy"
					className={styles.Image}
				/>
			</div>

			<div className={styles.Infos}>
				<h3 className={styles.Title}>{title}</h3>
				<div className={styles.Meta}>
					{year && <span className={styles.Year}>📅 {year}</span>}
					{rating !== undefined && (
						<span className={styles.Rating}>⭐ {truncRating}%</span>
					)}
				</div>
			</div>
		</div>
	);
}
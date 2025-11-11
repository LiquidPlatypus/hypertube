import styles from "./Thumbnail.module.css";

interface ThumbnailProps {
	thumbnailSrc: string;
	thumbnailAlt: string;
	title: string;
	year?: string | number;
	rating?: string | number;
}

export default function Thumbnail({
	thumbnailSrc,
	thumbnailAlt,
	title,
	year,
	rating
}: ThumbnailProps) {
	return (
		<div className={styles.Thumbnail}>
			<div className={styles.CoverWrapper}>
				<img
					src={thumbnailSrc}
					alt={thumbnailAlt}
					loading="lazy"
					className={styles.Image}
				/>
			</div>

			<div className={styles.Infos}>
				<h3 className={styles.Title}>{title}</h3>
				<div className={styles.Meta}>
					{year && <span className={styles.Year}>📅 {year}</span>}
					{rating && <span className={styles.Rating}>⭐ {rating}%</span>}
				</div>
			</div>
		</div>
	);
}
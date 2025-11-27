import styles from "./Thumbnail.module.css";

interface ThumbnailProps {
	thumbnailSrc: string;
	thumbnailAlt: string;
	title: string;
	year?: string | number;
	rating?: string | number;
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

	return (
		<div className={styles.Thumbnail} onClick={onClick} >
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
import { t } from "../../lang/i18n.tsx";

import styles from "./Thumbnail.module.css";

interface ThumbnailProps {
	thumbnailSrc?: string;
	thumbnailAlt: string;
	title: string;
	year?: string;
	rating?: number;
	watched?: boolean;
	onClick?: () => void;
}

export default function Thumbnail({
	thumbnailSrc,
	thumbnailAlt,
	title,
	year,
	rating,
	watched,
	onClick,
}: ThumbnailProps) {

	// Ajusté sur 100 et tronqué à la virgule.
	const truncRating = rating !== undefined ? Math.trunc(rating * 10) : undefined;

	return (
		<div className={styles.Thumbnail} onClick={onClick} >
			{watched && (
				<span className={styles.WatchedBadge}>✓ {t("thumbnail.watched")}</span>
			)}
			<div className={styles.CoverWrapper}>
				<img
					src={thumbnailSrc || "/assets/image-placeholder-vertical.jpg"}
					alt={thumbnailAlt}
					loading="lazy"
					className={`${styles.Image}${watched ? ` ${styles.Watched}` : ""}`}
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
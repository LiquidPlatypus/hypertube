import styles from "./Thumbnail.module.css";

interface ThumbnailProps {
	thumbnailSrc: string;
	thumbnailAlt: string;
}

export default function Thumbnail({
	thumbnailSrc,
	thumbnailAlt,
}: ThumbnailProps) {
	return (
		<div className={styles.Thumbnail}>
			<img className={styles.Thumbnail} src={thumbnailSrc} alt={thumbnailAlt} />
		</div>
	);
}
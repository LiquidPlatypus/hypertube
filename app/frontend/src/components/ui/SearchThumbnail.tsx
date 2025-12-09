import styles from "./SearchThumbnail.module.css";

interface SearchThumbnailProps {
  thumbnailSrc: string;
  title: string;
  year?: string | number;
  rating?: string | number;
  onClick?: () => void;
}

export default function SearchThumbnail({ thumbnailSrc, title, year, rating, onClick }: SearchThumbnailProps) {
  return (
    <div className={styles.SearchThumbnail} onClick={onClick}>
      <img src={thumbnailSrc} alt={title} className={styles.Image} />
      <div className={styles.Infos}>
        <div className={styles.Title}>{title}</div>
        <div className={styles.Meta}>
          {year && <span className={styles.Year}>📅 {year}</span>}
          {rating && <span className={styles.Rating}>⭐ {rating}%</span>}
        </div>
      </div>
    </div>
  );
}


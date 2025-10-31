import styles from "./Footer.module.css";

export default function Footer() {
	return (
		<footer className={styles.Footer}>
			<h1 className={styles.Title}>RetroTube TV</h1>

			{/* Scanlines overlay */}
			<div className={styles.ScanLine}></div>

			{/* Glow */}
			<div className={styles.Glow}></div>
		</footer>
	);
}
import styles from "./Header.module.css";

export default function Header() {
	return (
		<header className={styles.Header}>
			<div className={styles.Wrapper}>
				<h1 className={styles.Title}>RetroTube TV</h1>
			</div>
		</header>
	);
}
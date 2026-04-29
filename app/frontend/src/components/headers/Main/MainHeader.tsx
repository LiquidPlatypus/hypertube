import styles from "./MainHeader.module.css";

export default function MainHeader() {
	return (
		<header className={styles.Header}>
			<div className={styles.Wrapper}>
				<h1 className={styles.Title}>RetroTube TV</h1>
			</div>
		</header>
	);
}

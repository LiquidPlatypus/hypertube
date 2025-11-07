import styles from "./LoginHeader.module.css";

export default function LoginHeader() {
	return (
		<header className={styles.Header}>
			<div className={styles.Wrapper}>
				<h1 className={styles.Title}>RetroTube TV</h1>
			</div>
		</header>
	);
}
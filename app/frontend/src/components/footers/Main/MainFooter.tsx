import styles from "./MainFooter.module.css"

export default function MainFooter() {
	return (
		<header className={styles.Footer}>
			<div className={styles.Wrapper}>
				<h1 className={styles.Title}>Hypertube</h1>
			</div>
		</header>
	);
}
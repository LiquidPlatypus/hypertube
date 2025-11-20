import styles from "./MainFooter.module.css"

export default function MainFooter() {
	return (
		<footer className={styles.Footer}>
			<div className={styles.Wrapper}>
				<h1 className={styles.Title}>Hypertube – Projet 42 – 2025</h1>
				{/* <p>retro tube</p> */}
			</div>
		</footer>
	);
}
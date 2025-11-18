import styles from "./MainFooter.module.css"

export default function MainFooter() {
	return (
		<footer className={styles.Footer}>
			<div className={styles.Wrapper}>
				<p>Hypertube – Projet 42 – 2025</p>
			</div>
		</footer>
	);
}
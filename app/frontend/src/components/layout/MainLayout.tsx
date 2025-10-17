import styles from "./MainLayout.module.css";

export default function MainLayout() {
	return (
		<div className={styles.pageContainer}>
			<div className={styles.content}>
				<h2>PAGE D'ACCUEIL</h2>
				{/* Votre contenu principal ici */}
			</div>
		</div>
	);
}

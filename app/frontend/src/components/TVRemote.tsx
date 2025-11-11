import styles from "./TVRemote.module.css";
import Button from "./ui/Button.tsx";

export default function TVRemote() {
	return (
		<div className={styles.TVRemote}>
			<Button text="Search" size="small" shape="pill" className={styles.SearchBtn} />
			<Button text="Logout" size="small" shape="pill" className={styles.LogoutBtn} />
		</div>
	);
}
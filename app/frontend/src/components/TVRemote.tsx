import styles from "./TVRemote.module.css";
import Button from "./ui/Button.tsx";

export default function TVRemote() {
	return (
		<div className={styles.TVRemote}>
			<Button
				text="Search"
				size="small"
				shape="square"
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.SearchBtn}
			/>
			<Button
				text="Profile"
				size="small"
				shape="square"
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.ProfileBtn}
			/>
			<Button
				text="Logout"
				size="small"
				shape="square"
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.LogoutBtn}
			/>
		</div>
	);
}
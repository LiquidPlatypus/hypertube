import styles from "./Header.module.css";

export default function Header() {
	return (
		<header className={styles.container}>
			<h1 id={styles.title}>Ok.Tube</h1>
			<input type="text" id="Search" name="Search" placeholder="Search" />
			<button>Profile</button>
		</header>
	); // TODO: REMPLACER BOUTON PAR COMPONENT REACT
}

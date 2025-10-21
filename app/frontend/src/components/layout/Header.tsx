import styles from "./Header.module.css";
import ImageButton from "../ui/ImageButton.tsx";

export default function Header() {
	return (
		<header className={styles.container}>
			<h1 id={styles.title}>Ok.Tube</h1>
			<input type="text" id="Search" name="Search" placeholder="Search" />
			<ImageButton
				icon="src/assets/test/pp.png"
				onClick={() => console.log("PPPPP")}
				size="medium"
				style={{ borderRadius: "50%" }}
			/>
		</header>
	);
}

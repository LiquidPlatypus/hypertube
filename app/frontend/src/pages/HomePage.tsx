import styles from "./HomePage.module.css";

import MainLayout from "../components/layout/MainLayout.tsx";

export default function HomePage() {
	return (
		<div className={styles.homePage}>
			<MainLayout />
		</div>
	);
}

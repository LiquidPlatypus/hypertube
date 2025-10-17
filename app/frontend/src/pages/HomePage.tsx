import styles from "./HomePage.module.css";

import Header from "../components/layout/Header.tsx";
import MainLayout from "../components/layout/MainLayout.tsx";
import Footer from "../components/layout/Footer.tsx";

export default function HomePage() {
	return (
		<>
			<Header />
			<MainLayout />
			<Footer />
		</>
	);
}

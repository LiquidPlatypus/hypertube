import * as React from "react";

import MainHeader from "../components/headers/MainHeader.tsx";
import MainFooter from "../components/footers/MainFooter.tsx";

import styles from "./MainLayout.module.css";
import TVRemote from "../components/TVRemote.tsx";

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	const [fxEnabled, setFxEnabled] = React.useState(true);

	const toggleFx = () => setFxEnabled(v => !v);

	return (
		<div
			className={`${styles.MainLayout} ${!fxEnabled ? styles.noFx : ""}`}
			style={{
				"--header-height": "150px",
				"--footer-height": "100px",
			} as React.CSSProperties}
		>

			<header className={styles.MainHeader}>
				<MainHeader />
			</header>


			<main className={styles.ScrollArea}>
				{children}
			</main>

			<footer className={styles.MainFooter}>
				<MainFooter />
			</footer>

			<div className={styles.TVRemoteContainer}>
				<TVRemote onToggleFx={toggleFx} />
			</div>
		</div>
	);
}
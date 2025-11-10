import * as React from "react";

import MainHeader from "../components/headers/MainHeader.tsx";
import MainFooter from "../components/footers/MainFooter.tsx";

import styles from "./MainLayout.module.css";

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	return (
		<div
			className={styles.MainLayout}
			style={{
				"--header-height": "150px",
				"--footer-height": "100px",
			} as React.CSSProperties}
		>
			<video
				className={styles.BackgroundVideo}
				src="/videos/screen2.mp4"
				autoPlay
				muted
				loop
				playsInline
			/>
			<header className={styles.MainHeader}>
				<MainHeader />
			</header>

			<main className={styles.ScrollArea}>
				{children}
			</main>

			<footer className={styles.MainFooter}>
				<MainFooter />
			</footer>
		</div>
	);
}
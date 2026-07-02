import * as React from "react";

import MainHeader from "../../components/headers/Main/MainHeader.tsx";
import MainFooter from "../../components/footers/Main/MainFooter.tsx";
import TVRemote from "../../components/TVRemote.tsx";

import styles from "./MainLayout.module.css";

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	const [fxEnabled, setFxEnabled] = React.useState(true);
	const [remoteOpen, setRemoteOpen] = React.useState(false);

	const toggleFx = () => setFxEnabled(v => !v);
	const toggleRemote = () => setRemoteOpen(v => !v);

	return (
		<div
			className={`${styles.MainLayout} ${!fxEnabled ? styles.noFx : ""}`}
			style={{
				"--header-height": "150px",
				"--footer-height": "20px",
			} as React.CSSProperties}
		>

			<header className={styles.MainHeader}>
				<MainHeader />
			</header>

			<div className={styles.BackgroundWrapper}>
				<div className={styles.Background}></div>
			</div>

			<main className={styles.ScrollArea}>
				{children}
			</main>

			<footer className={styles.MainFooter}>
				<MainFooter />
			</footer>

			<div
				className={`${styles.TVRemoteContainer} ${
					remoteOpen ? styles.open : ""
				}`}
			>
				<TVRemote
					isOpen={remoteOpen}
					onToggleRemote={toggleRemote}
					onToggleFx={toggleFx} />
			</div>
		</div>
	);
}
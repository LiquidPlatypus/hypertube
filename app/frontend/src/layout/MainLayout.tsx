import * as React from "react";
import MainHeader from "../components/headers/MainHeader.tsx";
import MainFooter from "../components/footers/MainFooter.tsx";
import styles from "./MainLayout.module.css";
import TVRemote from "../components/TVRemote.tsx";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div
      className={styles.MainLayout}
      style={{
        "--header-height": "20px",
        "--footer-height": "20px",
      } as React.CSSProperties}
    >
      
      <header className={styles.MainHeader}>
        <MainHeader />
      </header>
    <div className={styles.CRT}></div>
		<div className={styles.Scanline}></div>
	  <div className={styles.BackgroundWrapper}>
		<div className={styles.Background}></div>
		
	  </div>

      {/* Contenu scrollable */}
      <main className={styles.ScrollArea}>
        {children}
      </main>

      {/* Footer fixe */}
      <footer className={styles.MainFooter}>
        <MainFooter />
      </footer>

      <div className={styles.TVRemoteContainer}>
				<TVRemote />
			</div>
    </div>
  );
}

import * as React from "react";

import Header from "../components/Header.tsx"
import Footer from "../components/Footer.tsx"

import styles from "./MainLayout.module.css";

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	return (
		<div className={styles.MainLayout}>
			<Header />
				{children}
			<Footer />
		</div>
	)
}
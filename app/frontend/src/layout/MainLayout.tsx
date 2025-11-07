import * as React from "react";

import MainHeader from "../components/headers/MainHeader.tsx";
import MainFooter from "../components/footers/MainFooter.tsx";

import styles from "./MainLayout.module.css";

interface MainLayoutProps {
	children: React.ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
	return (
		<div className={styles.MainLayout}>
			<MainHeader />
				{children}
			<MainFooter />
		</div>
	)
}
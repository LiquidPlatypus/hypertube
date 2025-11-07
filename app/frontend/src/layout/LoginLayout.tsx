import * as React from "react";

import Header from "../components/Header.tsx"
import Footer from "../components/Footer.tsx"

import styles from "./LoginLayout.module.css";

interface LoginLayoutProps {
	children: React.ReactNode
}

export default function LoginLayout({ children }: LoginLayoutProps) {
	return (
		<div className={styles.LoginLayout}>
			<Header />
				{children}
			<Footer />
		</div>
	)
}
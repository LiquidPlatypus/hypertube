import * as React from "react";

import LoginHeader from "../../components/headers/Login/LoginHeader.tsx"
import LoginFooter from "../../components/footers/Login/LoginFooter.tsx"

import styles from "./LoginLayout.module.css";

interface LoginLayoutProps {
	children: React.ReactNode
}

export default function LoginLayout({ children }: LoginLayoutProps) {
	return (
		<div className={styles.LoginLayout}>
			<LoginHeader />
				{children}
			<LoginFooter />
		</div>
	)
}
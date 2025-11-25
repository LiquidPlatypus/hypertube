import * as React from "react";

import LoginHeader from "../components/headers/LoginHeader.tsx"
import LoginFooter from "../components/footers/LoginFooter.tsx"

import styles from "./LoginLayout.module.css";

interface LoginLayoutProps {
	children: React.ReactNode
}

export default function LoginLayout({ children }: LoginLayoutProps) {
	return (
		<div className={styles.LoginLayout}>
			<LoginHeader className={styles.LoginHeader} />
				<div className={styles.LoginContent}>
					{children}
				</div>
			<LoginFooter className={styles.LoginFooter} />
		</div>



	)
}
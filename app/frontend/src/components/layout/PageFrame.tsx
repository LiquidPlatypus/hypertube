import styles from "./PageFrame.module.css";
import * as React from "react";

interface PageFrameProps {
	children: React.ReactNode;
}

export default function PageFrame({ children }: PageFrameProps) {
	return (
		<div className={styles.frame}>
			<div className={styles.sideLeft} />
			<div className={styles.content}>{children}</div>
			<div className={styles.sideRight} />
		</div>
	);
}

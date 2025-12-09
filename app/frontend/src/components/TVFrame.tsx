import { type ReactNode, useLayoutEffect, useState } from "react";
import styles from "./TVFrame.module.css";

interface RetroTvFrameProps {
	tvImageSrc: string;
	tvWidth: number;
	tvHeight: number;
	screenX: number;
	screenY: number;
	screenWidth: number;
	screenHeight: number;
	contentScale?: number;
	children?: ReactNode;
}

export default function RetroTvFrame({
	tvImageSrc,
	tvWidth,
	tvHeight,
	screenX,
	screenY,
	screenWidth,
	screenHeight,
	contentScale = 1,
	children,
}: RetroTvFrameProps) {
	const [isMobile, setIsMobile] = useState(false);

	// Détecte mobile pour agrandir la TV
	useLayoutEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Scale contenu interne
	const [contentScaleState, setContentScaleState] = useState(1);
	useLayoutEffect(() => {
		const baseWidth = 700;
		const baseHeight = 600;
		const newScale = Math.min(screenWidth / baseWidth, screenHeight / baseHeight);
		setContentScaleState(newScale);
	}, [screenWidth, screenHeight]);

	return (
		<div
			className={styles.TV}
			style={{
				width: tvWidth * (isMobile ? 1.25 : 1), // 🔥 TV plus grande sur mobile
				height: tvHeight * (isMobile ? 1.25 : 1),
			}}
		>
			<img
				src={tvImageSrc}
				alt="TV rétro"
				className={styles.TVImage}
				style={{
					objectFit: "cover", // remplit tout le conteneur
				}}
			/>

			<div
				className={styles.TVScreen}
				style={{
					top: screenY,
					left: screenX,
					width: screenWidth,
					height: screenHeight,
				}}
			>
				<div className={styles.CRTBackground}></div>
				<div className={styles.TVDynamicContent}>
					<div
						className={styles.DynamicContentCenter}
						style={{
							transform: `scale(${contentScaleState * contentScale})`,
							transformOrigin: "center center",
							width: "800px",
							height: "600px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						{children}
					</div>
				</div>
			</div>
		</div>
	);
}

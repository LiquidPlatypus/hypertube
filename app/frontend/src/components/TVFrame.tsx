import { type ReactNode, useState, useLayoutEffect } from "react";
import styles from "./TVFrame.module.css";

interface RetroTvFrameProps {
	videoSrc?: string;
	tvImageSrc: string;
	tvWidth: number;
	tvHeight: number;
	screenX: number;
	screenY: number;
	screenWidth: number;
	screenHeight: number;
	contentScale: number;
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
	const [scale, setScale] = useState(1);

	useLayoutEffect(() => {
		const updateScale = () => {
			const baseWidth = 700;
			const baseHeight = 600;
			const newScale = Math.min(screenWidth / baseWidth, screenHeight / baseHeight);
			setScale(newScale);
		};

		// Delay pour attendre le layout du DOM
		requestAnimationFrame(updateScale);

		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, [screenWidth, screenHeight]);

	return (
		<div className={styles.TV} style={{ width: tvWidth, height: tvHeight }}>
			<img src={tvImageSrc} alt="TV rétro" className={styles.TVImage} />

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
							transform: `scale(${scale * contentScale})`,
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

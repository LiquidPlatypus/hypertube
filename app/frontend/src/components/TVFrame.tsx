import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

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
	videoSrc,
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
	const screenRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0);

	useLayoutEffect(() => {
		const updateScale = () => {
			if (!screenRef.current)
				return;
			const rect = screenRef.current.getBoundingClientRect();

			const baseWidth = 800;
			const baseHeight = 600;

			const newScale = Math.min(rect.width / baseWidth, rect.height / baseHeight);
			setScale(newScale);
		};

		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, []);

	return (
		<div
			className={styles.TV}
			style={{ aspectRatio: `${tvWidth} / ${tvHeight}` }}
		>
			{/* TV */}
			<img
				src={tvImageSrc}
				alt="TV rétro"
				className={styles.TVImage}
			/>

			{/* Écran */}
			<div
				ref={screenRef}
				className={styles.TVScreen}
				style={{
					top: `${(screenY / tvHeight) * 190}%`,
					left: `${(screenX / tvWidth) * 140}%`,
					width: `${(screenWidth / tvWidth) * 59}%`,
					height: `${(screenHeight / tvHeight) * 59}%`,
				}}
			>
				<video
					src={videoSrc}
					autoPlay
					loop
					muted
					disablePictureInPicture={true}
					className={styles.TVVideo}
				/>

				{/* Contenu dynamique (login, profil, etc.) */}
				<div className={styles.TVDynamicContent}>
					<div
						className={styles.DynamicContentCenter}
						style={{
							transform: `scale(${scale * contentScale})`,
							transformOrigin: `center center`,
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

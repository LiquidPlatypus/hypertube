import * as React from "react";
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
	screenContainerRef?: React.RefObject<HTMLDivElement | null>;
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
	screenContainerRef,
	children,
}: RetroTvFrameProps) {
	const screenRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0);

	useLayoutEffect(() => {
		const el = screenRef.current;
		if (!el) return;

		const baseWidth = 800;
		const baseHeight = 600;
		const minScale = 0.4;
		const maxScale = 1.25;

		const compute = () => {
			const rect = el.getBoundingClientRect();
			const raw = Math.min(rect.width / baseWidth, rect.height / baseHeight);
			const next = Math.max(minScale, Math.min(maxScale, raw));
			setScale(next);
		};

		// 1) calcul immédiat
		compute();

		// 2) recalcul après layout stable (utile en devtools / transitions)
		requestAnimationFrame(() => requestAnimationFrame(compute));

		// 3) ResizeObserver : recalcul dès que .TVScreen change de taille
		const ro = new ResizeObserver(() => compute());
		ro.observe(el);

		// 4) optionnel: visualViewport (Firefox RDM / zoom)
		const vv = window.visualViewport;
		vv?.addEventListener("resize", compute);

		return () => {
			ro.disconnect();
			vv?.removeEventListener("resize", compute);
		};
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
				ref={(node) => {
					(screenRef as any).current = node;
					if (screenContainerRef) screenContainerRef.current = node;
				}}
				className={styles.TVScreen}
				style={{
					top: `${(screenY / tvHeight) * 135}%`,
					left: `${(screenX / tvWidth) * 42}%`,
					width: `${(screenWidth / tvWidth) * 100}%`,
					height: `${(screenHeight / tvHeight) * 100}%`,
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

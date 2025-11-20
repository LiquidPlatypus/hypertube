import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";
import styles from "./LoginPage.module.css";
import TvBootScreen from "../components/TvBootScreen.tsx";


export default function LoginPage() {
	const navigate = useNavigate();
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const [isZooming, setIsZooming] = useState(false);
	const [showTvBoot, setShowTvBoot] = useState(false);
	const [showBlack, setShowBlack] = useState(false);

	// Dimensions originales de la TV (carrée)
	const TV_SIZE = 6144;
	const SCREEN_X = 1150;
	const SCREEN_Y = 1900;
	const SCREEN_WIDTH = 2900;
	const SCREEN_HEIGHT = 2500;


	const [tvDims, setTvDims] = useState({
		tvWidth: TV_SIZE,
		tvHeight: TV_SIZE,
		screenX: SCREEN_X,
		screenY: SCREEN_Y,
		screenWidth: SCREEN_WIDTH,
		screenHeight: SCREEN_HEIGHT,
	});

	const handleLoginSuccess = () => {
		setIsZooming(true);
		// Après 1.5s (fin du zoom)
		setTimeout(() => {
		setShowBlack(true);
		setTimeout(() => {setShowTvBoot(true);}, 300);
		}, 1500);
	};

	// Adapter les dimensions à la fenêtre (scale limité)
	useEffect(() => {
		const handleResize = () => {
			const scale = Math.min(
				window.innerWidth / TV_SIZE,
				window.innerHeight / TV_SIZE,
				1
			);

			setTvDims({
				tvWidth: TV_SIZE * scale,
				tvHeight: TV_SIZE * scale,
				screenX: SCREEN_X * scale,
				screenY: SCREEN_Y * scale,
				screenWidth: SCREEN_WIDTH * scale,
				screenHeight: SCREEN_HEIGHT * scale,
			});
		};

		handleResize(); // initial
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Mettre à jour le transform-origin en fonction du centre de l'écran TV
	useEffect(() => {
	if (!wrapperRef.current) return;

	const originX = tvDims.screenX + tvDims.screenWidth / 2;
	const originY = tvDims.screenY + tvDims.screenHeight / 2;

	// Convertir en pourcentage pour rendre le zoom responsive
	const originXPercent = (originX / tvDims.tvWidth) * 100;
	const originYPercent = (originY / tvDims.tvHeight) * 100;

	wrapperRef.current.style.transformOrigin = `${originXPercent}% ${originYPercent}%`;
}, [tvDims]);


	return (
		<>
			{/* Wrapper transformé */}
			<div ref={wrapperRef} className={`${styles.pageWrapper} ${isZooming ? styles.zoomOut : ""}`}>
				<RetroTvFrame
					tvImageSrc="/assets/TV.png"
					tvWidth={tvDims.tvWidth}
					tvHeight={tvDims.tvHeight}
					screenX={tvDims.screenX}
					screenY={tvDims.screenY}
					screenWidth={tvDims.screenWidth}
					screenHeight={tvDims.screenHeight}
					contentScale={1}
				>
					{!isZooming && <LoginScreen onLoginSuccess={handleLoginSuccess} />}
				</RetroTvFrame>
			</div>

			{/* BlackOverlay hors du wrapper */}
			{showBlack && <div className={styles.BlackOverlay}></div>}

			{showTvBoot && <TvBootScreen onComplete={() => navigate("/")} />}
		</>
	);
}

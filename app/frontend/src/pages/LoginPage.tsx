import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
	const navigate = useNavigate();
	const [isZooming, setIsZooming] = useState(false);

	// Dimensions originales de la TV (carrée)
	const TV_SIZE = 6144; 
	const SCREEN_X = 1000; 
	const SCREEN_Y = 1000;
	const SCREEN_WIDTH = 4144;
	const SCREEN_HEIGHT = 4144;

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
		setTimeout(() => navigate("/"), 1500);
	};

	// Adapter les dimensions à la fenêtre (scale limité)
	useEffect(() => {
		const handleResize = () => {
			// Calcul du scale proportionnel
			const scale = Math.min(
				window.innerWidth / TV_SIZE,
				window.innerHeight / TV_SIZE,
				1 // ne jamais dépasser la taille originale
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

	return (
		<div className={`${styles.TVWrapper} ${isZooming ? styles.zoomOut : ""}`}>
			<RetroTvFrame
				videoSrc="/videos/screen2.mp4"
				tvImageSrc="/assets/TV.png"
				tvWidth={tvDims.tvWidth}
				tvHeight={tvDims.tvHeight}
				screenX={tvDims.screenX}
				screenY={tvDims.screenY}
				screenWidth={tvDims.screenWidth}
				screenHeight={tvDims.screenHeight}
				contentScale={1}
			>
				<LoginScreen onLoginSuccess={handleLoginSuccess} />
			</RetroTvFrame>
		</div>
	);
}






import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";
import TvBootScreen from "../components/TvBootScreen.tsx";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
	const navigate = useNavigate();
	const wrapperRef = useRef<HTMLDivElement | null>(null);

	// Mode : "login" ou "logout"
	const [mode, setMode] = useState<"login" | "logout">("login");
	const [isZooming, setIsZooming] = useState(false);
	const [showLoginScreen, setShowLoginScreen] = useState(true);
	const [showTvBoot, setShowTvBoot] = useState(false);

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

	// LOGIN SUCCESS : zoom vers l'intérieur
	const handleLoginSuccess = () => {
		setShowLoginScreen(false);
		setMode("login");
		setIsZooming(true); // zoom in
		setTimeout(() => setShowTvBoot(true), 1800);
	};

	useEffect(() => {
	if (localStorage.getItem("just_logged_out") === "true") {
		localStorage.removeItem("just_logged_out");

		// cacher login
		setShowLoginScreen(false);

		// mettre le wrapper à scale 6 immédiatement, sans transition
		if (wrapperRef.current) {
			wrapperRef.current.style.transition = "none";
			wrapperRef.current.style.transform = "scale(6)";
		}

		// petit délai pour que le navigateur applique le scale 6
		setTimeout(() => {
			if (wrapperRef.current) {
				// ajouter transition
				wrapperRef.current.style.transition = "transform 2.5s ease, opacity 1.5s ease";
				// déclencher le dezoom
				setMode("logout");
				setIsZooming(true);
				wrapperRef.current.style.transform = "scale(1)";
			}
		}, 20);

		// fin du dezoom
		setTimeout(() => {
			setMode("login");
			setIsZooming(false);
			setShowLoginScreen(true);
		}, 2600); // durée CSS
	}
}, []);


	// Resize TV
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

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Transform origin (centré sur l'écran)
	useEffect(() => {
		if (!wrapperRef.current) return;

		const originX = tvDims.screenX + tvDims.screenWidth / 2;
		const originY = tvDims.screenY + tvDims.screenHeight / 2;
		const originXPercent = (originX / tvDims.tvWidth) * 100;
		const originYPercent = (originY / tvDims.tvHeight) * 100;

		wrapperRef.current.style.transformOrigin = `${originXPercent}% ${originYPercent}%`;
	}, [tvDims]);

	return (
		<>
			<div
	ref={wrapperRef}
	className={`${styles.pageWrapper} ${
		isZooming ? (mode === "login" ? styles.zoomIn : styles.zoomOut) : ""
	}`}
>
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
		{showLoginScreen && <LoginScreen onLoginSuccess={handleLoginSuccess} />}
	</RetroTvFrame>
</div>


			{showTvBoot && <TvBootScreen onComplete={() => navigate("/")} />}
		</>
	);
}
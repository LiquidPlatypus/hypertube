import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";
import TvBootScreen from "../components/TvBootScreen.tsx";
import styles from "./LoginPage.module.css";

export default function LoginPage() {
	const navigate = useNavigate();
	const wrapperRef = useRef<HTMLDivElement | null>(null);

	// Ajout : key pour forcer remount
	const [wrapperKey, setWrapperKey] = useState(0);

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

	// LOGOUT : zoom OUT puis retour à l'écran login
	useEffect(() => {
		if (localStorage.getItem("just_logged_out") === "true") {
			localStorage.removeItem("just_logged_out");

			// cacher login
			setShowLoginScreen(false);

			// mettre le wrapper à scale 6 immédiatement
			if (wrapperRef.current) {
				wrapperRef.current.style.transition = "none";
				wrapperRef.current.style.transform = "scale(6)";
			}

			// petit délai pour appliquer scale(6)
			setTimeout(() => {
				if (wrapperRef.current) {
					wrapperRef.current.style.transition =
						"transform 2.5s ease, opacity 1.5s ease";

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

				// 🔥 Correction : force React à recréer le wrapper
				setWrapperKey((prev) => prev + 1);
			}, 2600);
		}
	}, []);

	useEffect(() => {
		const handleResize = () => {
			const isMobile = window.innerWidth < 768;
			const scale = Math.min(
					window.innerWidth / TV_SIZE,
					window.innerHeight / TV_SIZE,
					1
				);
			if (isMobile) {
				const screenWidth = TV_SIZE * scale * 0.7;
				const screenHeight = TV_SIZE * scale * 0.6;
				const screenX = (TV_SIZE * scale - screenWidth) / 5;
				const screenY = (TV_SIZE * scale - screenHeight) / 2 + 50;
				setTvDims({
					tvWidth: TV_SIZE * scale,
					tvHeight: TV_SIZE * scale,
					screenX,
					screenY,
					screenWidth,
					screenHeight,
				});
			} else {
				setTvDims({
					tvWidth: TV_SIZE * scale,
					tvHeight: TV_SIZE * scale,
					screenX: SCREEN_X * scale,
					screenY: SCREEN_Y * scale,
					screenWidth: SCREEN_WIDTH * scale,
					screenHeight: SCREEN_HEIGHT * scale,
				});
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);


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
				key={wrapperKey} // 🔥 essentiel pour rejouer l’animation
				ref={wrapperRef}
				className={`${styles.pageWrapper} ${
					isZooming
						? mode === "login"
							? styles.zoomIn
							: styles.zoomOut
						: ""
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
					{showLoginScreen && (
						<LoginScreen onLoginSuccess={handleLoginSuccess} />
					)}
				</RetroTvFrame>
			</div>

			{showTvBoot && <TvBootScreen onComplete={() => navigate("/")} />}
		</>
	);
}

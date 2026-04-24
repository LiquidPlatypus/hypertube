import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import RetroTvFrame from "../components/TVFrame";
import LoginScreen from "../utils/LoginScreen";

import styles from "./LoginPage.module.css";

type Mode = "login" | "logout";

export default function LoginPage() {
	const navigate = useNavigate();
	const wrapperRef = useRef<HTMLDivElement | null>(null);
	const tvScreenRef = useRef<HTMLDivElement | null>(null);

	const [mode, setMode] = useState<Mode>("login");
	const [isZooming, setIsZooming] = useState(false);

	const [wrapperKey, setWrapperKey] = useState(0);

	const [flashKey, setFlashKey] = useState(0);
	const [showWhiteFlash, setShowWhiteFlash] = useState(false);
	const [hideUi, setHideUi] = useState(false);

	const TV_BASE = useMemo(
		() => ({
			tvWidth: 1920,
			tvHeight: 1080,
			screenX: 560,
			screenY: 215,
			screenWidth: 1100,
			screenHeight: 500,
		}),
		[]
	);

	const [tvDims, setTvDims] = useState(TV_BASE);

	useEffect(() => {
		const handleResize = () => {
			const { innerWidth: w, innerHeight: h } = window;

			const safeH = Math.max(320, h - 60);

			const scale = Math.min(w / TV_BASE.tvWidth, safeH / TV_BASE.tvHeight, 1);
			const isMobile = w <= 768;

			if (isMobile) {
				const tvWidth = TV_BASE.tvWidth * scale;
				const tvHeight = TV_BASE.tvHeight * scale;

				setTvDims({
					tvWidth,
					tvHeight,
					screenX: TV_BASE.screenX * scale * 0.95,
					screenY: TV_BASE.screenY * scale * 1.05,
					screenWidth: TV_BASE.screenWidth * scale * 1.08,
					screenHeight: TV_BASE.screenHeight * scale * 1.12,
				});
			} else {
				setTvDims({
					tvWidth: TV_BASE.tvWidth * scale,
					tvHeight: TV_BASE.tvHeight * scale,
					screenX: TV_BASE.screenX * scale,
					screenY: TV_BASE.screenY * scale,
					screenWidth: TV_BASE.screenWidth * scale,
					screenHeight: TV_BASE.screenHeight * scale,
				});
			}
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [TV_BASE]);

	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const screen = tvScreenRef.current;
		if (!wrapper || !screen) return;

		const wrapperRect = wrapper.getBoundingClientRect();
		const screenRect = screen.getBoundingClientRect();

		const screenCenterX = screenRect.left + screenRect.width / 2;
		const screenCenterY = screenRect.top + screenRect.height / 2;

		const originXPercent = ((screenCenterX - wrapperRect.left) / wrapperRect.width) * 100;
		const originYPercent = ((screenCenterY - wrapperRect.top) / wrapperRect.height) * 100;

		wrapper.style.transformOrigin = `${originXPercent}% ${originYPercent}%`;
	}, [tvDims, wrapperKey]);

	const triggerWhiteFlash = useCallback((durationMs = 520) => {
		setFlashKey((k) => k + 1);
		setShowWhiteFlash(true);

		window.setTimeout(() => {
			setShowWhiteFlash(false);
		}, durationMs);
	}, []);

	const startZoom = useCallback((nextMode: Mode) => {
		setMode(nextMode);
		setIsZooming(false);

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				setIsZooming(true);
			});
		});
	}, []);

	const handleLoginSuccess = useCallback(() => {
		const FLASH_START = 160;
		const FLASH_DURATION = 2400;
		const NAV_AT = FLASH_START + 850;

		setShowWhiteFlash(false);

		setWrapperKey((k) => k + 1);

		setHideUi(true);
		startZoom("login");

		window.setTimeout(() => triggerWhiteFlash(FLASH_DURATION), FLASH_START);

		window.setTimeout(() => navigate("/"), NAV_AT);
	}, [navigate, startZoom, triggerWhiteFlash]);

	useLayoutEffect(() => {
		if (localStorage.getItem("just_logged_out") !== "true") return;
		localStorage.removeItem("just_logged_out");

		setHideUi(true);

		setShowWhiteFlash(false);
		setWrapperKey((k) => k + 1);

		startZoom("logout");

		window.setTimeout(() => triggerWhiteFlash(2000), 0);

		window.setTimeout(() => {
			setMode("login");
			setIsZooming(false);
			setHideUi(false);
			setWrapperKey((k) => k + 1);
		}, 2600);
	}, [startZoom, triggerWhiteFlash]);

	const wrapperClassName = [
		styles.pageWrapper,
		mode === "login" ? styles.login : styles.logout,
		isZooming ? (mode === "login" ? styles.zoomIn : styles.zoomOut) : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<>
			<div key={wrapperKey} ref={wrapperRef} className={wrapperClassName}>
				<div className={styles.TVWrapper}>
					<RetroTvFrame
						videoSrc="/videos/screen2.mp4"
						tvImageSrc="/assets/TV.png"
						tvWidth={tvDims.tvWidth}
						tvHeight={tvDims.tvHeight}
						screenX={tvDims.screenX}
						screenY={tvDims.screenY}
						screenWidth={tvDims.screenWidth}
						screenHeight={tvDims.screenHeight}
						contentScale={0.8}
						screenContainerRef={tvScreenRef}
					>
						<div className={`${styles.LoginUi} ${hideUi ? styles.LoginUiHidden : ""}`}>
							<LoginScreen onLoginSuccess={handleLoginSuccess} />
						</div>
					</RetroTvFrame>
				</div>
			</div>

			{showWhiteFlash && <div key={flashKey} className={styles.WhiteFlash} />}
		</>
	);
}
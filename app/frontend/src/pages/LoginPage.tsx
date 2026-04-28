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
	const tvWrapperRef = useRef<HTMLDivElement | null>(null);

	const [mode, setMode] = useState<Mode>("login");
	const [isZooming, setIsZooming] = useState(false);

	const [wrapperKey, setWrapperKey] = useState(0);

	const [flashKey, setFlashKey] = useState(0);
	const [showWhiteFlash, setShowWhiteFlash] = useState(false);
	const [hideUi, setHideUi] = useState(false);
	const [dollyZoom, setDollyZoom] = useState(1);

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

			const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
			const smoothstep = (t: number) => t * t * (3 - 2 * t);

			const W_START = 1400;
			const W_END = 420;
			const ZOOM_MIN = 1;
			const ZOOM_MAX = 2.05;

			const tRaw = (W_START - w) / (W_START - W_END);
			const t = smoothstep(clamp(tRaw, 0, 1));

			const nextZoom = ZOOM_MIN + (ZOOM_MAX - ZOOM_MIN) * t;

			const H_END = 520;
			if (h < H_END) {
				const extra = clamp((H_END - h) / 240, 0, 0.25);
				setDollyZoom(nextZoom + extra);
			} else {
				setDollyZoom(nextZoom);
			}

			setTvDims(TV_BASE);
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [TV_BASE]);

	useLayoutEffect(() => {
		const wrapper = tvWrapperRef.current;
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
				<div
					ref={tvWrapperRef}
					className={styles.TVWrapper}
					style={{
						transform: `scale(${(isZooming || hideUi) ? 1 : dollyZoom})`,
					}}
				>
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
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef, useCallback } from "react";
import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";
import TvBootScreen from "../components/TvBootScreen.tsx";
import styles from "./LoginPage.module.css";

type FtOauthResultMsg = {
  type: "FT_OAUTH_RESULT";
  code?: string | null;
  state?: string | null;
  error?: string | null;
  error_description?: string | null;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Ajout : key pour forcer remount (rejouer animation)
  const [wrapperKey, setWrapperKey] = useState(0);

  // Mode : "login" ou "logout"
  const [mode, setMode] = useState<"login" | "logout">("login");
  const [isZooming, setIsZooming] = useState(false);
  const [showLoginScreen, setShowLoginScreen] = useState(true);
  const [showTvBoot, setShowTvBoot] = useState(false);

  // Overlay / erreurs
  const [is42Loading, setIs42Loading] = useState(false);
  const [oauth42Error, setOauth42Error] = useState<string | null>(null);

  // Evite double handling message (StrictMode/dev)
  const handledMsgRef = useRef(false);

  // TV dims
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
  const handleLoginSuccess = useCallback(() => {
    setShowLoginScreen(false);
    setMode("login");
    setIsZooming(true);
    setTimeout(() => setShowTvBoot(true), 1800);
  }, []);

  // LOGOUT : zoom OUT puis retour login
  useEffect(() => {
    if (localStorage.getItem("just_logged_out") === "true") {
      localStorage.removeItem("just_logged_out");

      setShowLoginScreen(false);

      if (wrapperRef.current) {
        wrapperRef.current.style.transition = "none";
        wrapperRef.current.style.transform = "scale(6)";
      }

      setTimeout(() => {
        if (wrapperRef.current) {
          wrapperRef.current.style.transition = "transform 2.5s ease, opacity 1.5s ease";
          setMode("logout");
          setIsZooming(true);
          wrapperRef.current.style.transform = "scale(1)";
        }
      }, 20);

      setTimeout(() => {
        setMode("login");
        setIsZooming(false);
        setShowLoginScreen(true);
        setWrapperKey((prev) => prev + 1);
      }, 2600);
    }
  }, []);

  // Responsive
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      const scale = Math.min(window.innerWidth / TV_SIZE, window.innerHeight / TV_SIZE, 1);

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

  // Transform origin (zoom)
  useEffect(() => {
    if (!wrapperRef.current) return;

    const originX = tvDims.screenX + tvDims.screenWidth / 2;
    const originY = tvDims.screenY + tvDims.screenHeight / 2;
    const originXPercent = (originX / tvDims.tvWidth) * 100;
    const originYPercent = (originY / tvDims.tvHeight) * 100;

    wrapperRef.current.style.transformOrigin = `${originXPercent}% ${originYPercent}%`;
  }, [tvDims]);

  useEffect(() => {
    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      const data = event.data as FtOauthResultMsg;
      if (!data || data.type !== "FT_OAUTH_RESULT") return;

      // évite double handling (StrictMode)
      if (handledMsgRef.current) return;
      handledMsgRef.current = true;

      const { code, state, error, error_description } = data;

      if (error) {
        setIs42Loading(false);
        setOauth42Error(error_description || error || "Erreur OAuth 42");
        return;
      }

      const expectedState = sessionStorage.getItem("ft_oauth_state");
      sessionStorage.removeItem("ft_oauth_state");

      if (!code || !state || !expectedState || expectedState !== state) {
        setIs42Loading(false);
        setOauth42Error("Session OAuth expirée. Merci de réessayer.");
        return;
      }

      try {
        setOauth42Error(null);

        const resp = await fetch("/api/42-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, state }),
        });

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.detail || "Erreur auth 42");
        }

        const res = await resp.json();
        localStorage.setItem("access_token", res.access_token);

        // Rejouer l'anim proprement
        setWrapperKey((prev) => prev + 1);
        setShowTvBoot(false);
        setIsZooming(false);
        setMode("login");
        setShowLoginScreen(true);

        // petit délai stable UX, puis animation
        setTimeout(() => {
          setIs42Loading(false);
          handleLoginSuccess();
        }, 150);
      } catch (e) {
        setIs42Loading(false);
        setOauth42Error(e instanceof Error ? e.message : "Erreur inconnue");
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [handleLoginSuccess]);

  return (
    <>
      <div
        key={wrapperKey}
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
          {/* Overlay léger, sans "page blanche" */}
          {is42Loading && (
			<div
				style={{
				position: "absolute",
				inset: 0,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				pointerEvents: "none",
				color: "white",
				fontSize: 18,
				zIndex: 10,
				textShadow: "0 2px 10px rgba(0,0,0,0.85)",
				background: "transparent",
				}}
			>
				Connect to 42...
			</div>
			)}


          {oauth42Error && (
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 16,
                padding: 12,
                background: "rgba(0,0,0,0.65)",
                color: "white",
                borderRadius: 10,
                zIndex: 11,
              }}
            >
              {oauth42Error}
            </div>
          )}

          {showLoginScreen && (
            <LoginScreen
              onLoginSuccess={handleLoginSuccess}
              
            />
          )}
        </RetroTvFrame>
      </div>

      {showTvBoot && <TvBootScreen onComplete={() => navigate("/")} />}
    </>
  );
}


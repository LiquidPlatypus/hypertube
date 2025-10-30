import { useState } from "react";
import { useNavigate } from "react-router-dom";

import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";

export default function LoginPage() {
	const [isZooming, setIsZooming] = useState(false);
	const navigate = useNavigate();

	const handleLoginSuccess = () => {
		setIsZooming(true);
		setTimeout(() => navigate("/"), 800);
	};

	return (
		<div data-component="TVWrapper" className={`
				relative flex items-center justify-center my-4
				w-[95vw] max-w-[95rem] aspect-square
				transition-transform duration-[800ms] ease-in-out
				${isZooming ? "scale-[3] translate-y-[-20%] opacity-0 brightness-150" : ""}
			`}
		>
			<RetroTvFrame
				videoSrc="/videos/screen2.mp4"
				tvImageSrc="/assets/TV.png"
				tvWidth={1920}
				tvHeight={1080}
				screenX={400}
				screenY={200}
				screenWidth={1100}
				screenHeight={700}
				contentScale={1.2}
			>
				<LoginScreen onLoginSuccess={handleLoginSuccess} />
			</RetroTvFrame>
		</div>
	);
}

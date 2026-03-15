import { useNavigate } from "react-router-dom";

import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";

import styles from "./LoginPage.module.css";

export default function LoginPage() {
	const navigate = useNavigate();

	const handleLoginSuccess = () => {
		setTimeout(() => navigate("/"), 800);
	};

	return (
		<div className={styles.TVWrapper}>
			<RetroTvFrame
				videoSrc="/videos/screen2.mp4"
				tvImageSrc="/assets/TV4.png"
				tvWidth={1920}
				tvHeight={1080}
				screenX={560}
				screenY={215}
				screenWidth={1100}
				screenHeight={500}
				contentScale={1}
			>
				<LoginScreen onLoginSuccess={handleLoginSuccess} />
			</RetroTvFrame>
		</div>
	);
}

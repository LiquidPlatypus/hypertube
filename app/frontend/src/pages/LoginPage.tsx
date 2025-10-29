import RetroTvFrame from "../components/TVFrame.tsx";
import LoginScreen from "../utils/LoginScreen.tsx";

export default function LoginPage() {
	return (
		<RetroTvFrame
			videoSrc="videos/screen2.mp4"
			tvImageSrc="assets/TV.png"
			tvWidth={1920}
			tvHeight={1080}
			screenX={400}
			screenY={200}
			screenWidth={1100}
			screenHeight={700}
		>
			<LoginScreen />
		</RetroTvFrame>
	);
}

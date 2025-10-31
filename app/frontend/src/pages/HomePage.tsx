import styles from "./HomePage.module.css";

export default function HomePage() {
	return (
		<div className={styles.tmp}>
			<video
				src="/videos/screen2.mp4" // tu peux mettre n'importe quelle vidéo temporaire
				autoPlay
				loop
				muted
				className="w-full h-full object-cover rounded-lg shadow-lg"
			/>
		</div>
	);
}
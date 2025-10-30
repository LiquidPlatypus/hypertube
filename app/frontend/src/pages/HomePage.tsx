export default function HomePage() {
	return (
		<div className="w-full h-full flex items-center justify-center">
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
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";

interface RetroTvFrameProps {
	videoSrc: string;
	tvImageSrc: string;
	tvWidth: number;
	tvHeight: number;
	screenX: number;
	screenY: number;
	screenWidth: number;
	screenHeight: number;
	contentScale: number;
	children?: ReactNode;
}

export default function RetroTvFrame({
	videoSrc,
	tvImageSrc,
	tvWidth,
	tvHeight,
	screenX,
	screenY,
	screenWidth,
	screenHeight,
	contentScale = 1,
	children,
}: RetroTvFrameProps) {
	const screenRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(0);

	useLayoutEffect(() => {
		const updateScale = () => {
			if (!screenRef.current)
				return;
			const rect = screenRef.current.getBoundingClientRect();

			const baseWidth = 800;
			const baseHeight = 600;

			const newScale = Math.min(rect.width / baseWidth, rect.height / baseHeight);
			setScale(newScale);
		};

		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, []);

	return (
		<div
			data-component="TV"
			className="relative w-full h-full flex items-center justify-center"
			style={{ aspectRatio: `${tvWidth} / ${tvHeight}` }}
		>
			{/* TV */}
			<img
				src={tvImageSrc}
				alt="TV rétro"
				className="absolute w-full h-full z-20 pointer-events-none"
			/>

			{/* Écran */}
			<div
				ref={screenRef}
				data-component="TVScreen"
				className="absolute z-10 overflow-hidden"
				style={{
					top: `${(screenY / tvHeight) * 132}%`,
					left: `${(screenX / tvWidth) * 91}%`,
					width: `${(screenWidth / tvWidth) * 80}%`,
					height: `${(screenHeight / tvHeight) * 80}%`,
				}}
			>
				<video
					src={videoSrc}
					autoPlay
					loop
					muted
					disablePictureInPicture={true}
					className="w-full h-full object-cover"
				/>

				{/* Contenu dynamique (login, profil, etc.) */}
				<div data-component="TVDynamicContent" className="absolute inset-0 flex flex-col items-center justify-center p-4 overflow-hidden">
					<div
						className="origin-center"
						style={{
							transform: `scale(${scale * contentScale})`,
							transformOrigin: `center center`,
							width: "800px",
							height: "600px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						{children}
					</div>
				</div>

				{/* Effets CRT */}
				<div className="absolute inset-0 pointer-events-none bg-black/10 [background-size:2px_2px]"></div>
				<div className="absolute inset-0 pointer-events-none shadow-[0_0_20px_#ffbf00] rounded"></div>
			</div>
		</div>
	);
}

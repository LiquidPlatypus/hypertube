import { type ReactNode } from "react";

interface RetroTvFrameProps {
	videoSrc: string;
	tvImageSrc: string;
	tvWidth: number;
	tvHeight: number;
	screenX: number;
	screenY: number;
	screenWidth: number;
	screenHeight: number;
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
	children,
}: RetroTvFrameProps) {
	return (
		<div data-component="TV" className="relative w-full h-full flex items-center justify-center">
			{/* TV */}
			<img
				src={tvImageSrc}
				alt="TV rétro"
				className="absolute w-full h-full z-20 pointer-events-none"
			/>

			{/* Écran */}
			<div
				data-component="TVScreen"
				className="absolute z-10 overflow-hidden"
				style={{
					top: `${(screenY / tvHeight) * 145}%`,
					left: `${(screenX / tvWidth) * 63}%`,
					width: `${(screenWidth / tvWidth) * 100}%`,
					height: `${(screenHeight / tvHeight) * 70}%`,
				}}
			>
				<video
					src={videoSrc}
					autoPlay
					loop
					muted
					className="w-full h-full object-cover"
				/>

				{/* Contenu dynamique (login, profil, etc.) */}
				<div data-component="TVDynamicContent" className="absolute inset-0 flex flex-col items-center justify-center p-4 overflow-auto">
					{children}
				</div>

				{/* Effets CRT */}
				<div className="absolute inset-0 pointer-events-none bg-black/10 [background-size:2px_2px]"></div>
				<div className="absolute inset-0 pointer-events-none shadow-[0_0_20px_#ffbf00] rounded"></div>
			</div>
		</div>
	);
}

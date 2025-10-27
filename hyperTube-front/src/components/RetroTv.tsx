import React from "react";

interface RetroTvFinalProps {
  videoSrc: string;
  tvImageSrc: string;
  tvWidth: number;
  tvHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
}

const RetroTv: React.FC<RetroTvFinalProps> = ({
  videoSrc,
  tvImageSrc,
  tvWidth,
  tvHeight,
  screenX,
  screenY,
  screenWidth,
  screenHeight,
}) => {
 return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* TV PNG */}
      <img
        src={tvImageSrc}
        alt="TV rétro"
        className="absolute w-full h-full z-20 pointer-events-none"
      />

      {/* Écran */}
      <div
        className="absolute z-10 overflow-hidden"
        style={{
          top: `${(screenY / tvHeight) * 100}%`,
          left: `${(screenX / tvWidth) * 100}%`,
          width: `${(screenWidth / tvWidth) * 100}%`,
          height: `${(screenHeight / tvHeight) * 100}%`,
        }}
      >
        {/* Vidéo */}
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          className="w-full h-full object-cover"
        />

        {/* Overlay Login / boutons */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
          <h2 className="text-lg font-bold mb-2">Bienvenue sur Hypertube</h2>
          <input
            className="mb-2 p-2 rounded text-black"
            placeholder="Username"
          />
          <input
            className="mb-2 p-2 rounded text-black"
            type="password"
            placeholder="Password"
          />
          <button className="px-4 py-2 bg-amber-600 rounded hover:bg-amber-500">
            Se connecter
          </button>
        </div>

        {/* Scanlines overlay */}
        <div className="absolute inset-0 pointer-events-none bg-black/10 [background-size:2px_2px]"></div>

        {/* Glow autour de l'écran */}
        <div className="absolute inset-0 pointer-events-none shadow-[0_0_20px_#ffbf00] rounded"></div>
      </div>
    </div>
  );
};

export default RetroTv;

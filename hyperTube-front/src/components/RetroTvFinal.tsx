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

const RetroTvFinal: React.FC<RetroTvFinalProps> = ({
  videoSrc,
  tvImageSrc,
  tvWidth,
  tvHeight,
  screenX,
  screenY,
  screenWidth,
  screenHeight,
}) => {
  // Calcul padding %
  const paddingLeft = (screenX / tvWidth) * 100;
  const paddingTop = (screenY / tvHeight) * 100;
  const paddingRight = ((tvWidth - screenX - screenWidth) / tvWidth) * 100;
  const paddingBottom = ((tvHeight - screenY - screenHeight) / tvHeight) * 100;

  return (
    <div className="relative w-[100vw] max-w-screen aspect-square flex items-center justify-center scale-100">
      {/* Contenu de l'écran */}
      <div
        className="absolute inset-0 overflow-hidden rounded-md shadow-lg"
        style={{
          paddingLeft: `${paddingLeft}%`,
          paddingTop: `${paddingTop}%`,
          paddingRight: `${paddingRight}%`,
          paddingBottom: `${paddingBottom}%`,
        }}
      >
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          className="w-full h-full object-cover rounded-sm"
        />

        {/* Scanlines */}
        <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(transparent,transparent_1px,rgba(255,255,255,0.05)_2px)] animate-[scan_1s_linear_infinite]"></div>

        {/* Vignette / glow */}
        <div className="absolute inset-0 pointer-events-none rounded-md bg-gradient-to-b from-black/40 via-black/20 to-black/40"></div>
      </div>

      {/* Image TV */}
      <img
        src={tvImageSrc}
        alt="TV rétro"
        className="w-full h-full z-10 pointer-events-none select-none"
      />

      <style>
        {`
          @keyframes scan_1s_linear_infinite {
            0% { background-position: 0 0; }
            100% { background-position: 0 100%; }
          }
        `}
      </style>
    </div>
  );
};

export default RetroTvFinal;

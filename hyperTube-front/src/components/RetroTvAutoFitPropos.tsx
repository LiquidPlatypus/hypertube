import React from "react";

interface RetroTvAutoFitProps {
  videoSrc: string;
  tvImageSrc: string;
  tvWidth: number;      // largeur totale du PNG
  tvHeight: number;     // hauteur totale du PNG
  screenX: number;      // X de l'écran transparent
  screenY: number;      // Y de l'écran transparent
  screenWidth: number;  // largeur de l'écran
  screenHeight: number; // hauteur de l'écran
}

const RetroTvAutoFit: React.FC<RetroTvAutoFitProps> = ({
  videoSrc,
  tvImageSrc,
  tvWidth,
  tvHeight,
  screenX,
  screenY,
  screenWidth,
  screenHeight,
}) => {
  // Calcul du padding en %
  const paddingLeft = (screenX / tvWidth) * 100;
  const paddingTop = (screenY / tvHeight) * 100;
  const paddingRight = ((tvWidth - screenX - screenWidth) / tvWidth) * 100;
  const paddingBottom = ((tvHeight - screenY - screenHeight) / tvHeight) * 100;

  return (
    <div className="relative w-[90vw] max-w-3xl aspect-square scale-110 flex items-center justify-center">

      {/* Contenu de l'écran */}
      <div
        className="absolute inset-0 overflow-hidden"
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
          className="w-full h-full object-cover"
        />
        {/* Scanlines CRT */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(transparent,transparent_1px,rgba(255,255,255,0.05)_2px)] animate-[scan_1s_linear_infinite] pointer-events-none"></div>
      </div>

      {/* Image de la TV */}
      <img
        src={tvImageSrc}
        alt="TV rétro"
        className="w-full h-full z-10 pointer-events-none"
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

export default RetroTvAutoFit;

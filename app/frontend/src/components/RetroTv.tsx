import React, { type ReactNode } from "react";

interface RetroTvProps {
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

const RetroTvLoginWrapper: React.FC<RetroTvProps> = ({
  videoSrc,
  tvImageSrc,
  tvWidth,
  tvHeight,
  screenX,
  screenY,
  screenWidth,
  screenHeight,
  children,
}) => {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* TV */}
      <img
        src={tvImageSrc}
        alt="TV rétro"
        className="absolute w-full h-full z-20 pointer-events-none object-contain"
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
        <video
          src={videoSrc}
          autoPlay
          loop
          muted
          className="w-full h-full object-cover"
        />

        {/* Contenu enfant */}
        <div className="absolute inset-0 flex items-center justify-center p-4 overflow-auto">
          {children}
        </div>

        {/* Effets CRT */}
        <div className="absolute inset-0 pointer-events-none bg-black/10 [background-size:2px_2px]" />
        <div className="absolute inset-0 pointer-events-none shadow-[0_0_20px_#ffbf00] rounded" />
      </div>
    </div>
  );
};

export default RetroTvLoginWrapper;

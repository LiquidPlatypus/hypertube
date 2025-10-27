import React from "react";

const TvRetro: React.FC = () => {
 return (
    <div className="relative w-[90vw] max-w-3xl aspect-video flex items-center justify-center">

      {/* Contenu de l'écran */}
      <div className="absolute inset-0 p-[6%] rounded-xl overflow-hidden">
        <video
          src="https://www.w3schools.com/html/mov_bbb.mp4" // ton flux Hypertube
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
        src="/TV.png"
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

export default TvRetro;


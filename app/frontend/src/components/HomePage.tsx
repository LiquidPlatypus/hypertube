import { useEffect, useState } from "react";

interface HomePageProps {
  showProfile: boolean;
  setShowProfile: (value: boolean) => void;
}

export default function HomePage({ showProfile, setShowProfile }: HomePageProps) {
  const [zoomed, setZoomed] = useState(false);
  const [screenOn, setScreenOn] = useState(false);

  useEffect(() => {
    // Démarre le zoom
    const timerZoom = setTimeout(() => setZoomed(true), 100);
    // Affiche le contenu de l’écran
    const timerScreen = setTimeout(() => setScreenOn(true), 1500);

    return () => {
      clearTimeout(timerZoom);
      clearTimeout(timerScreen);
    };
  }, []);

  return (
    <div
      className="relative w-full"
      style={{ height: 'calc(100vh - 4rem - 3rem)' }} // espace header + footer
    >
      {/* Contenu derrière le PNG */}
      <div
        className={`absolute z-0 bg-black rounded-lg transition-opacity duration-1000 ease-in-out`}
        style={{
          width: "50%",
          height: "78%",
          top: "10%",
          left: "16%",
          opacity: screenOn ? 1 : 0,
        }}
      >
        <div className="w-full h-full flex flex-col items-center justify-center text-green-400 font-mono">
          <h1 className="text-3xl mb-4">Bienvenue sur RetroTV 📺</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setShowProfile(true)}
              className="bg-green-500 text-black font-bold px-4 py-2 rounded-lg hover:bg-green-400 transition"
            >
              Profil
            </button>
            <button className="bg-green-500 text-black font-bold px-4 py-2 rounded-lg hover:bg-green-400 transition">
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* PNG TV au-dessus du contenu */}
      <img
        src="/screen.png"
        alt="TV"
        className="absolute top-0 left-0 w-full h-full object-contain z-10"
        style={{
          transform: zoomed ? "scale(1)" : "scale(0.7)",
          transformOrigin: "center",
          transition: "transform 2s ease-in-out",
        }}
      />

      {/* Overlay Profil */}
      {showProfile && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
          <div className="bg-white p-6 rounded-lg shadow-lg text-black font-mono">
            <h2 className="text-xl mb-2">Profil utilisateur</h2>
            <button
              className="mt-4 bg-red-500 text-white px-4 py-2 rounded"
              onClick={() => setShowProfile(false)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

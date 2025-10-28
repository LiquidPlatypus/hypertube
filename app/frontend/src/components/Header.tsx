import { useState } from "react";
import defaultAvatar from "/vhs.jpg";

interface HeaderProps {
  setShowProfile: (value: boolean) => void;
}

export default function Header({ setShowProfile }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleProfileClick = () => {
    setShowProfile(true);   // affiche ProfilInfo
    setMenuOpen(false);     // ferme le menu
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setShowProfile(false);
    window.location.href = "/auth/login"; // redirection
  };

  return (
    <header className="w-full relative bg-black/90 text-amber-200 font-mono p-4 flex items-center justify-between shadow-[0_0_20px_#ffbf00]">
      <div className="flex items-center">
        <h1 className="text-xl drop-shadow-[0_0_5px_#ffbf00]">RetroTube TV</h1>
      </div>

      <div className="flex-1 mx-4 max-w-xs">
        <input
          type="text"
          placeholder="Rechercher un film ou une série..."
          className="w-full p-1.5 rounded bg-black/70 text-white placeholder-amber-300 border border-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm"
        />
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-14 w-14 rounded-full border-2 border-amber-200 overflow-hidden focus:outline-none"
        >
          <img src={defaultAvatar} alt="Avatar utilisateur" className="h-full w-full object-cover" />
        </button>

        {menuOpen && (
          <div className="absolute top-full left-1/3 mt-2 -translate-x-3/4 w-36 bg-black/90 border border-amber-200 rounded shadow-lg z-30 flex flex-col">
            <button onClick={handleProfileClick} className="px-4 py-2 text-white hover:bg-amber-700 text-left">
              Profil
            </button>
            <button onClick={handleLogout} className="px-4 py-2 text-white hover:bg-amber-700 text-left">
              Logout
            </button>
          </div>
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none bg-black/20 [background-size:2px_2px]"></div>
    </header>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import defaultAvatar from "/vhs.jpg";

interface HeaderProps {
  setShowProfile: (value: boolean) => void;
  isLoggedIn: boolean;
  setIsLoggedIn: (value: boolean) => void;
}

export default function Header({ setShowProfile, isLoggedIn, setIsLoggedIn }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleProfileClick = () => {
    setShowProfile(true);
    setMenuOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setIsLoggedIn(false);
    setShowProfile(false);
    navigate("/auth/login");
  };

  return (
    <header className="w-full relative bg-black/90 text-amber-200 font-mono px-5 py-2 flex items-center justify-between shadow-[0_0_15px_#ffbf00] h-16">
      <h1 className="text-lg drop-shadow-[0_0_3px_#ffbf00]">RetroTube TV</h1>

      {/* Avatar à droite */}
      {isLoggedIn && (
        <div className="relative flex justify-end w-24">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="h-14 w-14 rounded-full border-2 border-amber-200 overflow-hidden focus:outline-none"
          >
            <img src={defaultAvatar} alt="Avatar utilisateur" className="h-full w-full object-cover" />
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-32 bg-black/90 border border-amber-200 rounded shadow-lg flex flex-col text-sm z-30">
              <button onClick={handleProfileClick} className="px-3 py-1 text-white hover:bg-amber-700 text-left">
                Profil
              </button>
              <button onClick={handleLogout} className="px-3 py-1 text-white hover:bg-amber-700 text-left">
                Logout
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

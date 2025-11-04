import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RetroTvLoginWrapper from "./components/RetroTv";
import { useState } from "react";
import ProfilInfo from "./components/ProfilInfo";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";

function App() {
  const location = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("access_token"));

  const scale = 1.3;
  const tvProps = {
    videoSrc: "/screen2.mp4",
    tvImageSrc: "/TV.png",
    tvWidth: 6144 * scale,
    tvHeight: 6144 * scale,
    screenX: 1600 * scale,
    screenY: 1930 * scale,
    screenWidth: 2100 * scale,
    screenHeight: 2450 * scale,
  };

  const isAuthPage = location.pathname.startsWith("/auth");

  return (
    <div className="flex flex-col min-h-screen items-center justify-between bg-[url('/fond.png')] bg-repeat bg-center">
      {/* Header */}
      <Header
        setShowProfile={setShowProfile}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
      />

      {/* TV + contenu */}
      <div className="relative w-[120vw] max-w-[130rem] aspect-[4/3] flex items-center justify-center my-4">
        <RetroTvLoginWrapper {...tvProps}>
          {!isLoggedIn ? (
            isAuthPage ? (
              location.pathname === "/auth/login" ? (
                <LoginPage setIsLoggedIn={setIsLoggedIn} />
              ) : (
                <RegisterPage />
              )
            ) : (
              <p className="text-white text-center">Veuillez vous connecter</p>
            )
          ) : showProfile ? (
            <ProfilInfo setShowProfile={setShowProfile} />
          ) : (
            <Outlet />
          )}
        </RetroTvLoginWrapper>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;

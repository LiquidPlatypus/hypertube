import { Outlet, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RetroTvLoginWrapper from "./components/RetroTv";
import { useState } from "react";
import ProfilInfo from "./components/ProfilInfo";

function App() {
  const location = useLocation();
  const isAuthPage = location.pathname.startsWith("/auth");
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="flex flex-col min-h-screen items-center justify-between bg-[url('/fond.png')] bg-repeat bg-center">
      <Header setShowProfile={setShowProfile} />

      <div className="relative w-[95vw] max-w-[95rem] aspect-square flex items-center justify-center my-4">
        <RetroTvLoginWrapper
          videoSrc="/screen2.mp4"
          tvImageSrc="/TV.png"
          tvWidth={6144}
          tvHeight={6144}
          screenX={1200}
          screenY={1750}
          screenWidth={2832}
          screenHeight={2593}
        >
          {isAuthPage ? null : showProfile ? <ProfilInfo /> : <Outlet />}
        </RetroTvLoginWrapper>
      </div>

      <Footer />
    </div>
  );
}

export default App;


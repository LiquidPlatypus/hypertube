// import { useState } from "react";
// import Header from "./components/Header";
// import Footer from "./components/Footer";
// import RetroTvLoginWrapper from "./components/RetroTv";
// import ProfilInfo from "./components/ProfilInfo";
// import LoginPage from "./components/LoginPage";
// import RegisterPage from "./components/RegisterPage";
// import HomePage from "./components/HomePage";

// function App() {
//   const [showProfile, setShowProfile] = useState(false);
//   const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("access_token"));
//   const [showRegister, setShowRegister] = useState(false); // switch entre login et register

//   const scale = 1.3;
//   const tvProps = {
//     videoSrc: "/screen2.mp4",
//     tvImageSrc: "/TV.png",
//     tvWidth: 6144 * scale,
//     tvHeight: 6144 * scale,
//     screenX: 1600 * scale,
//     screenY: 1930 * scale,
//     screenWidth: 2100 * scale,
//     screenHeight: 2450 * scale,
//   };

//   // Handler pour logout centralisé
//   const handleLogout = () => {
//     localStorage.removeItem("access_token");
//     setIsLoggedIn(false);
//     setShowProfile(false);
//     setShowRegister(false); // remet le login par défaut
//   };

//   return (
//     <div className="flex flex-col min-h-screen items-center justify-between bg-[url('/fond.png')] bg-repeat bg-center">
//       {/* Header */}
//       <Header
//         setShowProfile={setShowProfile}
//         isLoggedIn={isLoggedIn}
//         setIsLoggedIn={setIsLoggedIn}
//         onLogout={handleLogout}
//       />

//       {/* Contenu central */}
//       <div className="relative w-[120vw] max-w-[130rem] aspect-[4/3] flex items-center justify-center my-4">
//         {!isLoggedIn ? (
//           <RetroTvLoginWrapper {...tvProps}>
//             {showRegister ? (
//               <RegisterPage 
//               setIsLoggedIn={setIsLoggedIn} 
//               switchToLogin={() => setShowRegister(false)}/>
//             ) : (
//               <LoginPage
//                 setIsLoggedIn={setIsLoggedIn}
//                 switchToRegister={() => setShowRegister(true)}
//               />
//             )}
//           </RetroTvLoginWrapper>
//         ) : showProfile ? (
//           <ProfilInfo setShowProfile={setShowProfile} />
//         ) : (
//           <HomePage showProfile={showProfile} setShowProfile={setShowProfile} />
//         )}
//       </div>

//       {/* Footer */}
//       <Footer />
//     </div>
//   );
// }


import { useState } from "react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import RetroTvLoginWrapper from "./components/RetroTv";
import ProfilInfo from "./components/ProfilInfo";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import HomePage from "./components/HomePage";

function App() {
  const [showProfile, setShowProfile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem("access_token"));
  const [showRegister, setShowRegister] = useState(false);

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

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setIsLoggedIn(false);
    setShowProfile(false);
    setShowRegister(false);
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <Header
        setShowProfile={setShowProfile}
        isLoggedIn={isLoggedIn}
        setIsLoggedIn={setIsLoggedIn}
        onLogout={handleLogout}
      />

      {/* Contenu central */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {/* RetroTV (login/register) */}
        {!isLoggedIn && (
          <div className="w-[120vw] max-w-[130rem] aspect-[4/3] flex items-center justify-center">
            <RetroTvLoginWrapper {...tvProps}>
              {showRegister ? (
                <RegisterPage
                  setIsLoggedIn={setIsLoggedIn}
                  switchToLogin={() => setShowRegister(false)}
                />
              ) : (
                <LoginPage
                  setIsLoggedIn={setIsLoggedIn}
                  switchToRegister={() => setShowRegister(true)}
                />
              )}
            </RetroTvLoginWrapper>
          </div>
        )}

        {/* HomePage */}
        {isLoggedIn && !showProfile && (
          <div
            className="relative w-full"
             style={{ height: 'calc(100vh - 4rem - 3rem)' }} // header + footer
          >
            <HomePage showProfile={showProfile} setShowProfile={setShowProfile} />
          </div>
        )}

        {/* Profil */}
        {showProfile && <ProfilInfo setShowProfile={setShowProfile} />}
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default App;

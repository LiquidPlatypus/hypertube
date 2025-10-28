import React, { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import Button from "./ui/Button.tsx";

interface RetroTvProps {
  videoSrc: string;
  tvImageSrc: string;
  tvWidth: number;
  tvHeight: number;
  screenX: number;
  screenY: number;
  screenWidth: number;
  screenHeight: number;
  children?: ReactNode; // ✅ Contenu dynamique (HomePage, ProfilInfo...)
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
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);

  // Login state
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Register state
  const [registerFirstname, setRegisterFirstname] = useState("");
  const [registerLastname, setRegisterLastname] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerPasswordConfirmation, setRegisterPasswordConfirmation] = useState("");

  const [message, setMessage] = useState("");

  // --- Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!response.ok) throw new Error("Identifiant ou mot de passe invalide");
      const data = await response.json();
      localStorage.setItem("access_token", data.access_token);
      navigate("/"); // redirection vers Home
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  // --- Register handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    if (registerPassword !== registerPasswordConfirmation) {
      setMessage("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerUsername,
          password: registerPassword,
          email: registerEmail,
          firstName: registerFirstname,
          lastName: registerLastname,
        }),
      });
      if (!response.ok) throw new Error("Erreur lors de l'inscription");
      const data = await response.json();
      if (data.returnValue) {
        setMessage("Compte créé ! Vous pouvez maintenant vous connecter.");
        setTimeout(() => {
          setIsLogin(true);
          setMessage("");
        }, 2000);
      } else {
        setMessage(data.message || "Impossible de créer le compte");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur lors de l'inscription");
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* TV */}
      <img src={tvImageSrc} alt="TV rétro" className="absolute w-full h-full z-20 pointer-events-none" />

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
        <video src={videoSrc} autoPlay loop muted className="w-full h-full object-cover" />

        {/* Contenu dynamique */}
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 overflow-auto">
          {children ? (
            children // ✅ Affiche le contenu passé depuis HomePage ou ProfilInfo
          ) : (
            // Formulaire rétro par défaut
            <div className="flex flex-col items-center justify-center text-white bg-black/60 backdrop-blur-md p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold mb-4">{isLogin ? "Connexion" : "Inscription"}</h2>

              {message && (
                <p className={`mb-4 text-center ${message.includes("créé") ? "text-green-400" : "text-red-400"}`}>
                  {message}
                </p>
              )}

              <div className="flex gap-3 mb-4">
                <Button text="Login" size="medium" shape="pill" onClick={() => { setIsLogin(true); setMessage(""); }} />
                <Button text="Register" size="medium" shape="pill" onClick={() => { setIsLogin(false); setMessage(""); }} />
              </div>

              {isLogin ? (
                <form className="flex flex-col gap-3 w-72" onSubmit={handleLogin}>
                  <input type="text" placeholder="Username" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <input type="password" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <Button text="Login" size="large" shape="pill" />
                </form>
              ) : (
                <form className="flex flex-col gap-3 w-72" onSubmit={handleRegister}>
                  <input type="text" placeholder="First Name" value={registerFirstname} onChange={(e) => setRegisterFirstname(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <input type="text" placeholder="Last Name" value={registerLastname} onChange={(e) => setRegisterLastname(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <input type="text" placeholder="Username" value={registerUsername} onChange={(e) => setRegisterUsername(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <input type="email" placeholder="Email" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <input type="password" placeholder="Password" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <input type="password" placeholder="Confirm Password" value={registerPasswordConfirmation} onChange={(e) => setRegisterPasswordConfirmation(e.target.value)} className="p-2 rounded border-2 border-yellow-400 bg-black text-white focus:outline-none focus:border-yellow-500" required />
                  <Button text="Register" size="large" shape="pill" />
                </form>
              )}
            </div>
          )}
        </div>

        {/* Scanlines et glow */}
        <div className="absolute inset-0 pointer-events-none bg-black/10 [background-size:2px_2px]"></div>
        <div className="absolute inset-0 pointer-events-none shadow-[0_0_20px_#ffbf00] rounded"></div>
      </div>
    </div>
  );
};

export default RetroTvLoginWrapper;

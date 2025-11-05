import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface LoginPageProps {
  setIsLoggedIn: (value: boolean) => void;
  switchToRegister: () => void;
}

export default function LoginPage({ setIsLoggedIn, switchToRegister }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) throw new Error("Identifiant ou mot de passe invalide");
      const data = await response.json();

      localStorage.setItem("access_token", data.access_token);
      setIsLoggedIn(true); // connexion réussie
      navigate("/", { replace: true });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 bg-black/70 border-2 border-[#eaad5a] rounded-lg shadow-[0_0_20px_#ffbf00] max-w-sm w-full text-white font-mono">
      <h2 className="text-2xl mb-2 text-[#fce5bf] drop-shadow-[0_0_5px_#ffbf00]">Connexion</h2>
      {message && <p className="text-red-500">{message}</p>}

      <form onSubmit={handleLogin} className="flex flex-col gap-3 w-full">
        <input
          type="text"
          placeholder="Nom d'utilisateur"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 bg-black/80 border border-[#eaad5a] focus:outline-none focus:border-yellow-500 rounded text-white"
          required
        />
        <input
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 bg-black/80 border border-[#eaad5a] focus:outline-none focus:border-yellow-500 rounded text-white"
          required
        />

        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            className="flex-1 bg-[#fce5bf] text-[#401d17] font-bold rounded py-2 hover:bg-[#FA8072] transition"
          >
            Login
          </button>

          <button
            type="button"
             onClick={switchToRegister}
            className="flex-1 bg-[#fce5bf] border border-[#fce5bf] text-[#401d17] font-bold rounded py-2 hover:bg-[#FA8072] transition"
          >
            Register
          </button>
        </div>
      </form>

      {/* Login externes */}
      <div className="flex flex-col gap-2 mt-4 w-full">
        <button className="bg-[#fce5bf] hover:bg-[#FA8072] text-[#401d17] font-bold rounded py-2 border-2 border-[#eaad5a] transition">
          Se connecter avec Google
        </button>
        <button className="bg-[#fce5bf] hover:bg-[#FA8072] text-[#401d17] font-bold rounded py-2 border-2 border-[#eaad5a] transition">
          Se connecter avec Intra42
        </button>
      </div>
    </div>
  );
}

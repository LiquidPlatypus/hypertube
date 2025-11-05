import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface RegisterPageProps {
  setIsLoggedIn: (value: boolean) => void;
  switchToLogin: () => void;
}

export default function RegisterPage({ setIsLoggedIn, switchToLogin }: RegisterPageProps) {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (password !== passwordConfirm) {
      setMessage("Les mots de passe ne correspondent pas");
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          email,
          firstName,
          lastName,
        }),
      });

      if (!response.ok) throw new Error("Erreur lors de l'inscription");

      setMessage("Compte créé ! Vous pouvez maintenant vous connecter.");
      setTimeout(() => navigate("/auth/login"), 1500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur inconnue");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6 bg-black/70 border-2 border-[#eaad5a] rounded-lg shadow-[0_0_20px_#ffbf00] max-w-sm w-full text-[#401d17] font-mono">
      <h2 className="text-2xl mb-2 text-[#fce5bf] drop-shadow-[0_0_5px_#ffbf00]">Inscription</h2>
      {message && <p className="text-[#401d17]">{message}</p>}

      <form onSubmit={handleRegister} className="flex flex-col gap-3 w-full">
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="p-2 bg-[#fce5bf] border-2 border-[#fce5bf] rounded text-[#401d17] focus:outline-none focus:ring-2 focus:ring-[#FA8072]"
          required
        />
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          className="p-2 bg-[#fce5bf] border-2 border-[#fce5bf] rounded text-[#401d17] focus:outline-none focus:ring-2 focus:ring-[#FA8072]"
          required
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          className="p-2 bg-[#fce5bf] border-2 border-[#fce5bf] rounded text-[#401d17] focus:outline-none focus:ring-2 focus:ring-[#FA8072]"
          required
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-2 bg-[#fce5bf] border-2 border-[#fce5bf] rounded text-[#401d17] focus:outline-none focus:ring-2 focus:ring-[#FA8072]"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-2 bg-[#fce5bf] border-2 border-[#fce5bf] rounded text-[#401d17] focus:outline-none focus:ring-2 focus:ring-[#FA8072]"
          required
        />
        <input
          type="password"
          placeholder="Confirm Password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          className="p-2 bg-[#fce5bf] border-2 border-[#fce5bf] rounded text-[#401d17] focus:outline-none focus:ring-2 focus:ring-[#FA8072]"
          required
        />

        <div className="flex gap-2 mt-2">
          <button
            type="submit"
            className="flex-1 bg-[#fce5bf] text-[#401d17] font-bold rounded py-2 hover:bg-[#FA8072] transition"
          >
            Register
          </button>
          <button
            type="button"
            onClick={switchToLogin}
            className="flex-1 bg-[#fce5bf] border border-[#fce5bf] text-[#401d17] font-bold rounded py-2 hover:bg-[#FA8072] transition"
          >
            Retour
          </button>
        </div>
      </form>
    </div>
  );
}

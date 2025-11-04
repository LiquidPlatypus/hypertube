import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
}

interface ProfilInfoProps {
  setShowProfile: (v: boolean) => void;
}

export default function ProfilInfo({ setShowProfile }: ProfilInfoProps) {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return;
      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Unauthorized");
        const data = await res.json();
        setUser(data.user);
      } catch {
        setUser(null);
      }
    };
    fetchUser();
  }, []);

  if (!user)
    return <p className="text-[#fce5bf] text-lg animate-pulse">Chargement...</p>;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-2 sm:px-4 text-center font-mono">
      <div className="border-2 border-[#eaad5a] p-3 sm:p-5 rounded-xl shadow-[0_0_20px_#ffbf00] w-[90%] max-w-[350px] bg-black/70">
        <h2 className="text-[clamp(1rem,4vw,1.5rem)] text-[#fce5bf] font-bold mb-2 sm:mb-4">
          {user.firstname} {user.lastname}
        </h2>
        <div className="space-y-1 sm:space-y-2 text-[clamp(0.7rem,3vw,1rem)] text-[#fce5bf]">
          <p>
            <span className="text-[#eaad5a]">ID:</span> {user.id}
          </p>
          <p>
            <span className="text-[#eaad5a]">Username:</span> {user.username}
          </p>
          <p>
            <span className="text-[#eaad5a]">Email:</span> {user.email}
          </p>
        </div>
        <button
          onClick={() => {
            setShowProfile(false);
            navigate("/");
          }}
          className="mt-4 sm:mt-6 px-3 py-1.5 bg-[#fce5bf] border border-[#eaad5a] text-[#401d17] font-bold rounded 
                     hover:bg-[#FA8072] hover:text-white transition-all duration-200 
                     text-[clamp(0.7rem,3vw,0.9rem)] shadow-[0_0_6px_#ffbf00] hover:shadow-[0_0_10px_#ffbf00]"
        >
          ⮌ Retour
        </button>
      </div>

      <p className="mt-4 sm:mt-6 text-xs sm:text-sm text-[#fce5bf] opacity-70">
        ▓▓▓ System Access Granted ▓▓▓
      </p>
    </div>
  );
}

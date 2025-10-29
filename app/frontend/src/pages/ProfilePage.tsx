import { useEffect, useState } from "react";

export default function ProfilInfo() {
	const [user, setUser] = useState<{ username: string; email: string; firstname: string; lastname: string } | null>(null);

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

	if (!user) return <p className="text-white text-lg">Chargement des infos...</p>;

	return (
		<div className="text-white text-center flex flex-col gap-2">
			<h2 className="text-xl font-bold">{user.firstname} {user.lastname}</h2>
			<p>Username: {user.username}</p>
			<p>Email: {user.email}</p>
		</div>
	);
}
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./ProfilePage.module.css";

export default function ProfilInfo() {
	const [user, setUser] = useState<{ username: string; email: string; firstname: string; lastname: string } | null>(null);
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

	if (!user) return <p className={styles.Loading}>Chargement des infos...</p>;

	return (
	<div className={styles.Container}>
		<div className={styles.CRTBox}>
			<div className={styles.TitleBar}>PROFIL UTILISATEUR</div>

			<div className={styles.InfosTab}>
				<h2 className={styles.Identity}>
					{user.firstname} {user.lastname}
				</h2>

				<p>Username : {user.username}</p>
				<p>Email : {user.email}</p>

				<button className={styles.EditButton}>
					Modifier le profil
				</button>
				<button className={styles.EditButton} onClick={() => navigate("/")}>
					Accueil
				</button>
			</div>
		</div>
	</div>
);

}


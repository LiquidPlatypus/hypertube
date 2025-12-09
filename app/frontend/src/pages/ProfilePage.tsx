import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation.tsx";

import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";
import styles from "./ProfilePage.module.css";

export default function ProfilInfo() {
	const [user, setUser] = useState<{ username: string; email: string; firstname: string; lastname: string; avatar?: string } | null>(null);
	const [avatar, setAvatar] = useState<string>("/assets/vhs.jpg");
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({ username: "", firstname: "", lastname: "", email: "" });
	const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);

	const { t } = useTranslation();


		//----------------------------------
		// UseEffect lorsqu'il y aura une db
		// ---------------------------------
	// 	useEffect(() => {
	// 	const token = localStorage.getItem("access_token");
	// 	if (!token) return;

	// 	const fetchUserAndAvatar = async () => {
	// 		try {
	// 			// -----------------------------
	// 			// Récupération des infos utilisateur
	// 			// -----------------------------
	// 			const resUser = await fetch("/api/me", {
	// 				headers: { Authorization: `Bearer ${token}` },
	// 			});
	// 			if (!resUser.ok) throw new Error("Unauthorized");
	// 			const dataUser = await resUser.json();

	// 			// Adapter selon ce que renverra la DB
	// 			const userFromDB = {
	// 				id: dataUser.user.id,
	// 				username: dataUser.user.username,
	// 				firstname: dataUser.user.firstname,
	// 				lastname: dataUser.user.lastname,
	// 				email: dataUser.user.email,
	// 				avatarUrl: dataUser.user.avatarUrl || "/assets/vhs.jpg", // si DB fournit avatarUrl
	// 			};

	// 			setUser(userFromDB);
	// 			setFormData({
	// 				username: userFromDB.username,
	// 				firstname: userFromDB.firstname,
	// 				lastname: userFromDB.lastname,
	// 				email: userFromDB.email,
	// 			});

	// 			// -----------------------------
	// 			// Récupération de l'avatar
	// 			// -----------------------------
	// 			if (userFromDB.avatarUrl.startsWith("http")) {
	// 				setAvatar(userFromDB.avatarUrl);
	// 			} else {
	// 				// Si c’est un chemin local (ou fichier sur serveur)
	// 				const resAvatar = await fetch("/api/me/profile-pic", {
	// 					headers: { Authorization: `Bearer ${token}` },
	// 				});
	// 				if (resAvatar.ok) {
	// 					const contentType = resAvatar.headers.get("content-type");
	// 					if (contentType?.includes("image")) {
	// 						const blob = await resAvatar.blob();
	// 						setAvatar(URL.createObjectURL(blob));
	// 					} else {
	// 						setAvatar("/assets/vhs.jpg");
	// 					}
	// 				} else {
	// 					setAvatar("/assets/vhs.jpg");
	// 				}
	// 			}
	// 		} catch (err) {
	// 			console.error("Erreur fetch user/avatar:", err);
	// 			setUser(null);
	// 			setAvatar("/assets/vhs.jpg");
	// 		}
	// 	};

	// 	fetchUserAndAvatar();
	// }, []);

	// Charger infos + avatar
	useEffect(() => {
		const token = localStorage.getItem("access_token");
		if (!token) return;

		const fetchUser = async () => {
			try {
				const res = await fetch("/api/me", {
					headers: { Authorization: `Bearer ${token}` }
				});
				if (!res.ok) throw new Error("Unauthorized");
				const data = await res.json();
				setUser(data.user);
				setFormData(data.user);
			} catch {
				setUser(null);
			}
		};

		const fetchAvatar = async () => {
				try {
					const res = await fetch("/api/me/profile-pic", {
						headers: { Authorization: `Bearer ${token}` }
					});
					if (!res.ok) throw new Error("No avatar");

					const contentType = res.headers.get("content-type");

					// Si le backend renvoie une image
					if (contentType?.includes("image")) {
						const blob = await res.blob();
						setAvatar(URL.createObjectURL(blob));
					} else {
						// Sinon, si c'est un chemin local ou rien
						setAvatar("/assets/vhs.jpg");
					}
				} catch {
					setAvatar("/assets/vhs.jpg");
				}
			};

		fetchUser();
		fetchAvatar();
	}, []);


	const handleProfileEdit = () => setIsEditing(true);
	const handleInputChange = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setNewAvatarFile(file);
		if (file) {
			// Affiche immédiatement l'image sélectionnée côté front
			setAvatar(URL.createObjectURL(file));
		}
	};

	const handleCancel = () => {
		setIsEditing(false);
		if (user) {
			setFormData({ username: user.username, firstname: user.firstname, lastname: user.lastname, email: user.email });
			setAvatar(user.avatar || "/assets/vhs.jpg");
		}
		setNewAvatarFile(null);
	};

	const handleSave = async () => {
	const token = localStorage.getItem("access_token");
	if (!token) return;

	try {
		// 1️⃣ Mettre à jour les infos utilisateur
		const res = await fetch("/api/modify-profile", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(formData),
		});
		if (!res.ok) throw new Error("Erreur mise à jour infos");
		setUser({ ...user!, ...formData });

		// 2️⃣ Si un nouvel avatar est sélectionné
		if (newAvatarFile) {
			const formDataAvatar = new FormData();
			formDataAvatar.append("file", newAvatarFile);

			const resAvatar = await fetch("/api/upload-picture", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formDataAvatar,
			});

			if (!resAvatar.ok) throw new Error("Erreur upload avatar");

			// Comme le backend ne renvoie pas l'URL publique,
			// on récupère le fichier en faisant un fetch vers /api/me/profile-pic
			const avatarRes = await fetch("/api/me/profile-pic", {
				headers: { Authorization: `Bearer ${token}` },
			});

			if (avatarRes.ok) {
				// Crée un blob pour l'afficher immédiatement
				const blob = await avatarRes.blob();
				const objectUrl = URL.createObjectURL(blob);
				setAvatar(objectUrl);
			}
			setNewAvatarFile(null);
		}

		setIsEditing(false);
	} catch (error) {
		console.error("profile.errorUpdate", error);
	}
};
if (!user) return <p className={styles.Loading}>Chargement des infos...</p>;

	return (
		<div className={styles.Container}>
			<div className={styles.CRTBox}>
				<div className={styles.TitleBar}>
					{t("profile.userProfile")}
				</div>

				{/* AVATAR*/}
				<div className={`${styles.AvatarWrapper} ${isEditing ? styles.AvatarEditing : ""}`}>
 					<label>
 						<img src={avatar} alt="Avatar" className={`${styles.AvatarImage} ${!isEditing ? styles.DisableClick : ""}`} />
 						{isEditing && (
 							<input type="file" accept="image/*" className={styles.HiddenFileInput} onChange={handleAvatarChange} />
 						)}
 					</label>
 				</div>
				{/* INFORMATIONS UTILISATEUR */}
				<div className={styles.InfosTab}>
					<div className={styles.keys}>
						<p>{t("register.placeholder.firstname")}</p>
						<p>{t("register.placeholder.lastname")}</p>
						<p>{t("profile.username")}</p>
						<p>{t("profile.email")}</p>
					</div>

					<div className={styles.values}>
						{isEditing ? (
							<div className={styles.editValues}>
								<Input
									type="text"
									placeholder={t("register.placeholder.firstname")}
									value={formData.firstname}
									variant="profileEdit"
									onChange={(e) => handleInputChange("firstname", e.target.value)}
									size="medium"
									shape="square"
									required
								/>

								<Input
									type="text"
									placeholder={t("register.placeholder.lastname")}
									value={formData.lastname}
									variant="profileEdit"
									onChange={(e) => handleInputChange("lastname", e.target.value)}
									size="medium"
									shape="square"
									required
								/>

								<Input
									type="text"
									placeholder={t("register.placeholder.username")}
									value={formData.username}
									variant="profileEdit"
									onChange={(e) => handleInputChange("username", e.target.value)}
									size="medium"
									shape="square"
									required
								/>

								<Input
									type="email"
									placeholder={t("register.placeholder.email")}
									value={formData.email}
									variant="profileEdit"
									onChange={(e) => handleInputChange("email", e.target.value)}
									size="medium"
									shape="square"
									required
								/>
							</div>
						) : (
							<>
								<p>{user.firstname}</p>
								<p>{user.lastname}</p>
								<p>{user.username}</p>
								<p>{user.email}</p>
							</>
						)}
					</div>
				</div>
				{/* BOUTONS*/}
				{isEditing ? (
					<div className={styles.buttonGroup}>
						<Button text={t("profile.save")} size="large" shape="square" variant="profileEdit" onClick={handleSave} />
						<Button text={t("profile.cancel")} size="large" shape="square" variant="profileEdit" onClick={handleCancel} />
					</div>
				) : (
					<Button text={t("profile.edit")} size="large" shape="square" variant="profileEdit" onClick={handleProfileEdit} />
				)}
			</div>
		</div>
	);
}
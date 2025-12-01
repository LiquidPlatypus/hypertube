// import { useEffect, useState } from "react";
// import { useTranslation } from "../hooks/useTranslation.tsx";

// import Button from "../components/ui/Button.tsx"
// import Input from "../components/ui/Input.tsx";
// import styles from "./ProfilePage.module.css";

// export default function ProfilInfo() {
// 	const [user, setUser] = useState<{ username: string; email: string; firstname: string; lastname: string } | null>(null);
// 	const [isEditing, setIsEditing] = useState(false);
// 	const [formData, setFormData] = useState({
// 		username: "",
// 		firstname: "",
// 		lastname: "",
// 		email: "",
// 	});

// 	const { t } = useTranslation();

// 	useEffect(() => {
// 		const fetchUser = async () => {
// 			const token = localStorage.getItem("access_token");
// 			if (!token) return;

// 			try {
// 				const res = await fetch("/api/me", {
// 					headers: { Authorization: `Bearer ${token}` },
// 				});
// 				if (!res.ok) throw new Error("Unauthorized");
// 				const data = await res.json();
// 				setUser(data.user);
// 			} catch {
// 				setUser(null);
// 			}
// 		};
// 		fetchUser();
// 	}, []);

// 	const handleProfileEdit = () => {
// 		setIsEditing(true);
// 	}

// 	const handleInputChange = (field: string, value: string) => {
// 		setFormData(prev => ({
// 			...prev,
// 			[field]: value
// 		}));
// 	}

// 	const handleCancel = () => {
// 		setIsEditing(false);
// 		if (user) {
// 			setFormData(user);
// 		}
// 	}

// 	const handleSave = async () => {
// 		const token = localStorage.getItem("access_token");
// 		if (!token)
// 			return;

// 		try {
// 			const res = await fetch("/api/modify-profile", {
// 				method: "POST",
// 				headers: {
// 					Authorization: `Bearer ${token}`,
// 					"Content-Type": "application/json"
// 				},
// 				body: JSON.stringify(formData)
// 			});

// 			if (!res.ok)
// 				throw new Error(t("profile.failedUpdate"));

// 			const data = await res.json();
// 			setUser(data.user);
// 			setIsEditing(false);
// 		} catch (error) {
// 			console.error("profile.errorUpdate", error);
// 		}
// 	}

// 	if (!user) return <p className={styles.Loading}>Chargement des infos...</p>;

// 	return (
// 		<div className={styles.Container}>
// 			<div className={styles.CRTBox}>
// 				<div className={styles.TitleBar}>{t("profile.userProfile")}</div>

// 				<div className={styles.InfosTab}>
// 					<div className={styles.keys}>
// 						<p>{t("register.placeholder.firstname")}</p>
// 						<p>{t("register.placeholder.lastname")}</p>
// 						<p>{t("profile.username")}</p>
// 						<p>{t("profile.email")}</p>
// 					</div>

// 					<div className={styles.values}>
// 						{isEditing ? (
// 							<div className={styles.editValues}>
// 								<Input
// 									type="text"
// 									placeholder={t("register.placeholder.firstname")}
// 									value={formData.firstname}
// 									variant="profileEdit"
// 									onChange={(e) => handleInputChange("firstname", e.target.value)}
// 									size="medium"
// 									shape="square"
// 									className={styles.EditInput}
// 									required
// 								/>
// 								<Input
// 									type="text"
// 									placeholder={t("register.placeholder.lastname")}
// 									value={formData.lastname}
// 									variant="profileEdit"
// 									onChange={(e) => handleInputChange("lastname", e.target.value)}
// 									size="medium"
// 									shape="square"
// 									className={styles.EditInput}
// 									required
// 								/>
// 								<Input
// 									type="text"
// 									placeholder={t("register.placeholder.username")}
// 									value={formData.username}
// 									variant="profileEdit"
// 									onChange={(e) => handleInputChange("username", e.target.value)}
// 									size="medium"
// 									shape="square"
// 									className={styles.EditInput}
// 									required
// 								/>
// 								<Input
// 									type="email"
// 									placeholder={t("register.placeholder.email")}
// 									value={formData.email}
// 									variant="profileEdit"
// 									onChange={(e) => handleInputChange("email", e.target.value)}
// 									size="medium"
// 									shape="square"
// 									className={styles.EditInput}
// 									required
// 								/>
// 							</div>
// 						) : (
// 							<>
// 								<p>{user.firstname}</p>
// 								<p>{user.lastname}</p>
// 								<p>{user.username}</p>
// 								<p>{user.email}</p>
// 							</>
// 						)}
// 					</div>
// 				</div>

// 				{isEditing ? (
// 					<div className={styles.buttonGroup}>
// 						<Button
// 							text={t("profile.save")}
// 							size="large"
// 							shape="square"
// 							variant="profileEdit"
// 							onClick={handleSave}
// 						/>
// 						<Button
// 							text={t("profile.cancel")}
// 							size="large"
// 							shape="square"
// 							variant="profileEdit"
// 							onClick={handleCancel}
// 						/>
// 					</div>
// 				) : (
// 					<Button
// 						text={t("profile.edit")}
// 						size="large"
// 						shape="square"
// 						variant="profileEdit"
// 						onClick={handleProfileEdit}
// 					/>
// 				)}
// 			</div>
// 		</div>
// 	);
// }
import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation.tsx";

import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";
import styles from "./ProfilePage.module.css";

export default function ProfilInfo() {
	const [user, setUser] = useState<{ username: string; email: string; firstname: string; lastname: string } | null>(null);
	const [avatar, setAvatar] = useState<string>("/assets/vhs.jpg");
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({
		username: "",
		firstname: "",
		lastname: "",
		email: "",
	});
	const [newAvatarFile, setNewAvatarFile] = useState<File | null>(null);

	const { t } = useTranslation();

	useEffect(() => {
		const token = localStorage.getItem("access_token");
		if (!token) return;

		const fetchUser = async () => {
			try {
				const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
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
				const res = await fetch("/api/me/profile-pic", { headers: { Authorization: `Bearer ${token}` } });
				if (!res.ok) throw new Error("No avatar");
				const url = await res.text();

				// Utiliser l'URL si c'est une URL valide, sinon image par défaut
				if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
					setAvatar(url);
				} else {
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

	const handleInputChange = (field: string, value: string) => {
		setFormData(prev => ({ ...prev, [field]: value }));
	};

	const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0] || null;
		setNewAvatarFile(file);
		if (file) setAvatar(URL.createObjectURL(file));
	};

	const handleCancel = () => {
		setIsEditing(false);
		if (user) setFormData(user);
		setNewAvatarFile(null);
	};

	const handleSave = async () => {
		const token = localStorage.getItem("access_token");
		if (!token) return;

		try {
			// Update profile info
			const res = await fetch("/api/modify-profile", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify(formData)
			});
			if (!res.ok) throw new Error(t("profile.failedUpdate"));
			const data = await res.json();
			setUser(data.user);

			// Upload new avatar
			if (newAvatarFile) {
				const formDataAvatar = new FormData();
				formDataAvatar.append("file", newAvatarFile);
				const resAvatar = await fetch("/api/upload-picture", {
					method: "POST",
					headers: { Authorization: `Bearer ${token}` },
					body: formDataAvatar
				});
				if (!resAvatar.ok) throw new Error("Avatar upload failed");
				const avatarUrl = await resAvatar.text();
				setAvatar(avatarUrl || "/assets/vhs.jpg");
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
				<div className={styles.TitleBar}>{t("profile.userProfile")}</div>

				{/* Infos et avatar */}
				<div className={styles.InfosTab}>
					<div className={styles.keys}>
						<p>{t("profile.avatar")}</p>
						<p>{t("register.placeholder.firstname")}</p>
						<p>{t("register.placeholder.lastname")}</p>
						<p>{t("profile.username")}</p>
						<p>{t("profile.email")}</p>
					</div>

					<div className={styles.values}>
						{/* Avatar */}
						<p>
							<label>
								<img
									src={avatar}
									alt="Avatar"
									className={`${styles.AvatarImage} ${!isEditing ? styles.DisableClick : ""}`}
								/>
								{isEditing && (
									<input
										type="file"
										accept="image/*"
										className={styles.HiddenFileInput}
										onChange={handleAvatarChange}
									/>
								)}
							</label>
						</p>

						{/* Infos utilisateur */}
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
									className={styles.EditInput}
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
									className={styles.EditInput}
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
									className={styles.EditInput}
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
									className={styles.EditInput}
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

				{/* Boutons */}
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



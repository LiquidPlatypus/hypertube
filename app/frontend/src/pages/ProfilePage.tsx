import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation.tsx";

import Button from "../components/ui/Button.tsx"
import styles from "./ProfilePage.module.css";

export default function ProfilInfo() {
	const [user, setUser] = useState<{ username: string; email: string; firstname: string; lastname: string } | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({
		username: "",
		firstname: "",
		lastname: "",
		email: "",
	});

	const { t } = useTranslation();

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

	const handleProfileEdit = () => {
		setIsEditing(true);
	}

	const handleInputChange = (field: string, value: string) => {
		setFormData(prev => ({
			...prev,
			[field]: value
		}));
	}

	const handleCancel = () => {
		setIsEditing(false);
		if (user) {
			setFormData(user);
		}
	}

	const handleSave = async () => {
		const token = localStorage.getItem("access_token");
		if (!token)
			return;

		try {
			const res = await fetch("/api/modify-profile", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json"
				},
				body: JSON.stringify(formData)
			});

			if (!res.ok)
				throw new Error(t("profile.failedUpdate"));

			const data = await res.json();
			setUser(data.user);
			setIsEditing(false);
		} catch (error) {
			console.error("profile.errorUpdate", error);
		}
	}

	if (!user) return <p className={styles.Loading}>Chargement des infos...</p>;

	return (
		<div className={styles.Container}>
			<div className={styles.CRTBox}>
				<div className={styles.TitleBar}>{t("profile.userProfile")}</div>

				<div className={styles.InfosTab}>
					<div className={styles.keys}>
						<p>{t("register.placeholder.firstname")}</p>
						<p>{t("register.placeholder.lastname")}</p>
						<p>{t("profile.username")}</p>
						<p>{t("profile.email")}</p>
					</div>

					<div className={styles.values}>
						{isEditing ? (
							<>
								<input
									type="text"
									value={formData.firstname}
									onChange={(e) => handleInputChange("firstname", e.target.value)}
									className={styles.EditInput}
								/>
								<input
									type="text"
									value={formData.lastname}
									onChange={(e) => handleInputChange("lastname", e.target.value)}
									className={styles.EditInput}
								/>
								<input
									type="text"
									value={formData.username}
									onChange={(e) => handleInputChange("username", e.target.value)}
									className={styles.EditInput}
								/>
								<input
									type="email"
									value={formData.email}
									onChange={(e) => handleInputChange("email", e.target.value)}
									className={styles.EditInput}
								/>
							</>
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

				{isEditing ? (
					<div className={styles.ButtonGroup}>
						<Button
							text={t("profile.save")}
							size="large"
							shape="square"
							className={styles.SaveButton}
							onClick={handleSave}
						/>
						<Button
							text={t("profile.cancel")}
							size="large"
							shape="square"
							className={styles.CancelButton}
							onClick={handleCancel}
						/>
					</div>
				) : (
					<Button
						text={t("profile.edit")}
						size="large"
						shape="square"
						className={styles.EditButton}
						onClick={handleProfileEdit}
					/>
				)}
			</div>
		</div>
	);
}
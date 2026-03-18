import { useEffect, useState } from "react";
import { useTranslation } from "../hooks/useTranslation.tsx";

import Button from "../components/ui/Button.tsx"
import Input from "../components/ui/Input.tsx";
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

	const toForm = (u: any) => ({
		username: u.username ?? "",
		firstname: u.firstname ?? "",
		lastname: u.lastname ?? "",
		email: u.email ?? "",
	})

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

	useEffect(() => {
		if (!user) return ;
		if (!isEditing) setFormData(toForm(user));
	}, [user, isEditing]);

	const handleProfileEdit = () => {
		if (user) setFormData(toForm(user));
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

			const res2 = await fetch("/api/me", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json"
				},
			})

			if (!res2.ok)
				throw new Error(t("profile.failedUpdate"));

			const data2 = await res2.json();
			setUser(data2.user);
			setIsEditing(false);
		} catch (error) {
			console.error("profile.errorUpdate", error);
		}
	}

	if (!user) return <p className={styles.Loading}>{t("loading")}</p>;

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

				{isEditing ? (
					<div className={styles.buttonGroup}>
						<Button
							text={t("profile.save")}
							size="large"
							shape="square"
							variant="profileEdit"
							onClick={handleSave}
						/>
						<Button
							text={t("profile.cancel")}
							size="large"
							shape="square"
							variant="profileEdit"
							onClick={handleCancel}
						/>
					</div>
				) : (
					<Button
						text={t("profile.edit")}
						size="large"
						shape="square"
						variant="profileEdit"
						onClick={handleProfileEdit}
					/>
				)}
			</div>
		</div>
	);
}
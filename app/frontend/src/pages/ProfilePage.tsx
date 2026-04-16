import {useEffect, useRef, useState} from "react";
import { useTranslation } from "../hooks/useTranslation.tsx";

import Button from "../components/ui/Button.tsx"
import Input from "../components/ui/Input.tsx";
import styles from "./ProfilePage.module.css";

type User = {
	username: string;
	email: string;
	firstname: string;
	lastname: string;
}

export default function ProfilInfo() {
	const [user, setUser] = useState<User | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [formData, setFormData] = useState({
		username: "",
		firstname: "",
		lastname: "",
		email: "",
	});

	// Photo actuelle
	const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);

	// Preview
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const { t } = useTranslation();

	const toForm = (u: any) => ({
		username: u.username ?? "",
		firstname: u.firstname ?? "",
		lastname: u.lastname ?? "",
		email: u.email ?? "",
	})

	const getToken = () => localStorage.getItem("access_token");

	const fetchProfilePic = async () => {
		const token = getToken();
		if (!token) return;

		const res = await fetch("/api/me/profile-pic", {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!res.ok) {
			setProfilePicUrl(null);
			return;
		}

		const ct = res.headers.get("content-type") || "";

		// 1. FileResponse
		if (ct.startsWith("image/")) {
			const blob = await res.blob();

			// Révoque l'ancienne si blob aussi
			setProfilePicUrl((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return URL.createObjectURL(blob);
			});
			return;
		}

		// 2. Url si google ou null
		const txt = (await res.text()).trim();
		if (!txt || txt === "null" || txt === "None") {
			setProfilePicUrl(null);
			return;
		}
		if (txt.startsWith("http")) {
			// si http selon comment fastapi sérialise
			const cleaned = txt.replace(/^"+|"+$/g, "");
			setProfilePicUrl(cleaned);
			return;
		}

		setProfilePicUrl(null);
	};

	useEffect(() => {
		const fetchUser = async () => {
			const token = getToken();
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
		fetchProfilePic();

		// Clean url blob quand exit page
		return () => {
			setProfilePicUrl((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return prev;
			});
			setLocalPreviewUrl((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return prev;
			});
		};
	}, []);

	useEffect(() => {
		if (!user) return;
		if (!isEditing) setFormData(toForm(user));
	}, [user, isEditing]);

	useEffect(() => {
		if (!selectedFile) {
			setLocalPreviewUrl((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return null;
			});
			return;
		}

		const url = URL.createObjectURL(selectedFile);
		setLocalPreviewUrl((prev) => {
			if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
			return url;
		});
	}, [selectedFile]);

	const handleInputChange = (field: string, value: string) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleProfileEdit = () => {
		if (user) setFormData(toForm(toForm(user)));
		setIsEditing(true);
	};

	const handleCancel = () => {
		setIsEditing(false);
		setSelectedFile(null);
	};

	const uploadSelectedPictureIfAny = async () => {
		const token = getToken();
		if (!token || !selectedFile) return;

		const fd = new FormData();
		fd.append("file", selectedFile);

		const res = await fetch("/api/upload-picture", {
			method: "POST",
			headers: { Authorization: `Bearer ${token}` },
			body: fd,
		});

		if (!res.ok) {
			throw new Error(await res.text().catch(() => "Upload failed"));
		}

		setSelectedFile(null);

		await fetchProfilePic();
	}

	const handleSave = async () => {
		const token = getToken();
		if (!token) return;

		try {
			// 1) Upload la photo si l’utilisateur en a choisi une
			await uploadSelectedPictureIfAny();

			// 2) Sauve les champs texte
			const res = await fetch("/api/modify-profile", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			if (!res.ok) throw new Error(t("profile.failedUpdate"));

			// 3) Refresh user
			const res2 = await fetch("/api/me", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
			});

			if (!res2.ok) throw new Error(t("profile.failedUpdate"));

			const data2 = await res2.json();
			setUser(data2.user);
			setIsEditing(false);
		} catch (error) {
			console.error("profile.errorUpdate", error);
		}
	};

	const handlePickFileClick = () => {
		if (!isEditing) return;
		fileInputRef.current?.click();
	};

	const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
		if (!isEditing) return;
		const f = e.target.files[0] ?? null;
		setSelectedFile(f);
	};

	const handleUploadPicture = async () => {
		const token = getToken();
		if (!token || !selectedFile) return;

		const fd = new FormData();
		fd.append("file", selectedFile);

		const res = await fetch("/api/upload-picture", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
			},
			body: fd,
		});

		if (!res.ok) {
			console.error("Upload failed", await res.text().catch(() => ""));
			return;
		}

		// reset input/preview
		setSelectedFile(null);

		// Re-fetch la photo depuis le backend
		await fetchProfilePic();
	};

	if (!user) return <p className={styles.Loading}>{t("loading")}</p>;

	const displayedPic =
		// preview
		localPreviewUrl ??
		// photo du back
		profilePicUrl ??
		// fallback
		"/assets/Profil.png";

	return (
		<div className={styles.Container}>
			<div className={styles.CRTBox}>
				<div>
					<img
						src={displayedPic}
						alt="profile picture"
					/>
				</div>

				{isEditing && (
					<>
						<input
							ref={fileInputRef}
							type="file"
							accept="image/*"
							style={{ display: "none" }}
							onChange={handleFileChange}
						/>

						<div style={{ marginTop: "1rem" }}>
							<Button
								text={t("profile.editPicture")}
								size="large"
								shape="square"
								variant="profileEdit"
								onClick={handlePickFileClick}
							/>
						</div>

						{selectedFile ? (
							<p style={{ marginTop: "0.5rem" }}>
								{t("profile.selectedFile")} : <strong>{selectedFile.name}</strong>
							</p>
						) : null}
					</>
				)}

				<div className={styles.TitleBar}>{t("profile.userProfile")}</div>

				<div className={styles.InfosTab}>
					<div className={styles.row}>
						<p className={styles.key}>{t("register.placeholder.firstname")}</p>
						<div className={styles.value}>
							{isEditing ? (
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
							) : (
								<p>{user.firstname}</p>
							)}
						</div>
					</div>

					<div className={styles.row}>
						<p className={styles.key}>{t("register.placeholder.lastname")}</p>
						<div className={styles.value}>
							{isEditing ? (
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
							) : (
								<p>{user.lastname}</p>
							)}
						</div>
					</div>

					<div className={styles.row}>
						<p className={styles.key}>{t("profile.username")}</p>
						<div className={styles.value}>
							{isEditing ? (
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
							) : (
								<p>{user.username}</p>
							)}
						</div>
					</div>

					<div className={styles.row}>
						<p className={styles.key}>{t("profile.email")}</p>
						<div className={styles.value}>
							{isEditing ? (
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
							) : (
								<p>{user.email}</p>
							)}
						</div>
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
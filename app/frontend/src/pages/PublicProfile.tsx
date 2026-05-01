import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./ProfilePage.module.css";

type PublicUser = {
	id: number;
	username: string;
	firstname: string;
	lastname: string;
};

export default function PublicProfile() {
	const { id } = useParams<{ id: string }>();
	const { t } = useTranslation();

	const [user, setUser] = useState<PublicUser | null>(null);
	const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const getToken = () => localStorage.getItem("access_token");

	const fetchPublicUser = async (userId: number) => {
		const token = getToken();
		if (!token) {
			setError("Unauthorized");
			setUser(null);
			return;
		}

		const res = await fetch(`/api/users/${userId}`, {
			headers: { Authorization: `Bearer ${token}` },
		});

		if (!res.ok) {
			setError(await res.text().catch(() => "Failed to fetch user"));
			setUser(null);
			return;
		}

		const data = await res.json();
		setUser(data.user ?? null);
		setError(null);
	};

	const fetchPublicProfilePic = async (userId: number) => {
		const token = getToken();
		if (!token) return;

		const res = await fetch(`/api/users/${userId}/profile-pic`, {
			headers: { Authorization: `Bearer ${token}` },
			cache: "no-store",
		});

		if (!res.ok) {
			setProfilePicUrl(null);
			return;
		}

		const ct = res.headers.get("content-type") || "";

		// 1) FileResponse => image/*
		if (ct.startsWith("image/")) {
			const blob = await res.blob();
			setProfilePicUrl((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return URL.createObjectURL(blob);
			});
			return;
		}

		// 2) Sinon texte: URL google ou "null"
		const txt = (await res.text()).trim();
		if (!txt || txt === "null" || txt === "None") {
			setProfilePicUrl(null);
			return;
		}
		if (txt.startsWith("http")) {
			const cleaned = txt.replace(/^"+|"+$/g, "");
			setProfilePicUrl(cleaned);
			return;
		}

		setProfilePicUrl(null);
	};

	useEffect(() => {
		let cancelled = false;

		const userId = Number(id);
		if (!id || Number.isNaN(userId)) {
			setError("Invalid user id");
			setUser(null);
			return;
		}

		(async () => {
			await fetchPublicUser(userId);
			await fetchPublicProfilePic(userId);
		})().catch((e) => {
			if (!cancelled) setError(String(e));
		});

		return () => {
			cancelled = true;
			setProfilePicUrl((prev) => {
				if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
				return prev;
			});
		};
	}, [id]);

	if (error) {
		return <p className={styles.Loading}>{t("error")}{String(error)}</p>;
	}

	if (!user) {
		return <p className={styles.Loading}>{t("loading")}</p>;
	}

	const displayedPic = profilePicUrl ?? "/assets/Profil.png";

	return (
		<div className={styles.Container}>
			<div className={styles.CRTBox}>
				<div className={styles.LeftColumn}>
					<div className={styles.ProfilePic}>
						<img src={displayedPic} alt="profile picture" />
					</div>
				</div>

				<div className={styles.RightColumn}>
					<div className={styles.TitleBar}>
						{t("profile.userProfile")}
					</div>

					<div className={styles.InfosTab}>
						<div className={styles.row}>
							<p className={styles.key}>{t("register.placeholder.firstname")}</p>
							<div className={styles.value}>
								<p>{user.firstname}</p>
							</div>
						</div>

						<div className={styles.row}>
							<p className={styles.key}>{t("register.placeholder.lastname")}</p>
							<div className={styles.value}>
								<p>{user.lastname}</p>
							</div>
						</div>

						<div className={styles.row}>
							<p className={styles.key}>{t("profile.username")}</p>
							<div className={styles.value}>
								<p>{user.username}</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

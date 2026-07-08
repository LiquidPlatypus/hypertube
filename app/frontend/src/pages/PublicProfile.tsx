import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./ProfilePage.module.css";

type PublicUserResponse = {
	user_id: number;
	username: string;
	pic_url: string | null;
};

export default function PublicProfile() {
	const { username } = useParams<{ username: string }>();
	const { t } = useTranslation();

	const [user, setUser] = useState<PublicUserResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const displayedUsername = useMemo(() => (username ?? "").trim(), [username]);

	const getToken = () => localStorage.getItem("access_token");

	useEffect(() => {
		let cancelled = false;

		if (!displayedUsername) {
			setError("Invalid username");
			setUser(null);
			return;
		}

		(async () => {
			const token = getToken();
			if (!token) {
				setError("Unauthorized");
				setUser(null);
				return;
			}

			const res = await fetch(
				`/api/users/${encodeURIComponent(displayedUsername)}`,
				{ headers: { Authorization: `Bearer ${token}` } }
			);

			if (!res.ok) {
				const txt = await res.text().catch(() => "");
				if (!cancelled) {
					setError(txt || `Failed to fetch user (${res.status})`);
					setUser(null);
				}
				return;
			}

			const data: PublicUserResponse = await res.json();

			if (!cancelled) {
				setUser(data ?? null);
				setError(null);
			}
		})().catch((e) => {
			if (!cancelled) {
				setError(String(e));
				setUser(null);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [displayedUsername]);

	if (error) {
		return (
			<p className={styles.Loading}>
				{t("error")}
				{String(error)}
			</p>
		);
	}

	if (!user) {
		return <p className={styles.Loading}>{t("loading")}</p>;
	}

	const displayedPic =
		user.pic_url && user.pic_url.startsWith("http")
			? user.pic_url
			: "/assets/Profil.png";

	return (
		<div className={styles.Container}>
			<div className={styles.CRTBox}>
				<div className={styles.LeftColumn}>
					<div className={styles.ProfilePic}>
						<img src={displayedPic} alt="profile picture" />
					</div>
				</div>

				<div className={styles.RightColumn}>
					<div className={styles.TitleBar}>{t("profile.userProfile")}</div>

					<div className={styles.InfosTab}>
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
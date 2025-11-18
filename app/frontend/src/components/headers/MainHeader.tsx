import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./MainHeader.module.css";
import defaultAvatar from "/assets/vhs.jpg";

export default function MainHeader() {
	const [menuOpen, setMenuOpen] = useState(false);
	const navigate = useNavigate();
	const menuRef = useRef<HTMLDivElement>(null);  // référence au menu
	const avatarRef = useRef<HTMLImageElement>(null); // référence à l'avatar

	const toggleMenu = () => setMenuOpen(!menuOpen);

	const handleLogout = () => {
		localStorage.removeItem("authToken");
		navigate("/auth/login");
	};

	// Fermer le menu si clic en dehors
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				menuOpen &&
				menuRef.current &&
				avatarRef.current &&
				!menuRef.current.contains(event.target as Node) &&
				!avatarRef.current.contains(event.target as Node)
			) {
				setMenuOpen(false);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [menuOpen]);

	return (
		<header className={styles.Header}>
			<div className={styles.Left}>
				<h1 className={styles.Title}>RetroTube TV</h1>
			</div>

			<div className={styles.Center}>
				<input
					type="text"
					className={styles.SearchInput}
					placeholder="Rechercher un film..."
				/>
			</div>

			<div className={styles.Right}>
				<img
					src={defaultAvatar}
					alt="Avatar utilisateur"
					className={styles.Avatar}
					onClick={toggleMenu}
					ref={avatarRef}
				/>

				{menuOpen && (
					<div className={styles.DropdownMenu} ref={menuRef}>
						<ul>
							<li onClick={() => navigate("/profile")}>Profil</li>
							<li onClick={handleLogout}>Logout</li>
						</ul>
					</div>
				)}
			</div>
		</header>
	);
}

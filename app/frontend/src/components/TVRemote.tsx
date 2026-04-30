import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Button from "./ui/Button.tsx";
import SearchBar from "./ui/SearchBar.tsx";
import { useSearch } from "../utils/searchContext.tsx";
import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./TVRemote.module.css";

interface TVRemoteProps {
	isOpen: boolean;
	onToggleRemote: () => void;
	onToggleFx?: () => void;
}

export default function TVRemote({
	                                 isOpen,
	                                 onToggleRemote,
	                                 onToggleFx,
                                 }: TVRemoteProps) {
	const navigate = useNavigate();
	const [showSearch, setShowSearch] = useState(false);
	const { currentLang, changeLang } = useTranslation();
	const { setSearchTerm } = useSearch();

	const goHome = () => {
		setSearchTerm("");
		closeSearchModal();
		navigate("/");
	};

	const toggleSearchBar = () => {
		setShowSearch((prev) => !prev);
	};

	const closeSearchModal = () => {
		setShowSearch(false);
	};

	const goToProfile = () => {
		navigate("/profile");
	};

	const handleChangeLang = async () => {
		const newLang = currentLang === "en" ? "fr" : "en";
		await changeLang(newLang);
	};

	const handleLogout = () => {
		try {
			localStorage.removeItem("access_token");
			localStorage.setItem("just_logged_out", "true");
			navigate("/auth/login");
		} catch (error) {
			console.error("Logout failed:", error);
		}
	};

	useEffect(() => {
		if (!showSearch) return;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSearchModal();
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [showSearch]);

	return (
		<div className={styles.TVRemote}>
			<Button
				size="small"
				shape="square"
				icon="/assets/Icons/Arrow.svg"
				className={`${styles.remoteToggleBtn} ${
					isOpen ? styles.remoteToggleBtnOpen : ""
				}`}
				variant="remote"
				onClick={onToggleRemote}
			/>

			<Button
				size="small"
				shape="square"
				icon="/assets/Icons/HomeW.svg"
				className={styles.HomeBtn}
				variant="remote"
				onClick={goHome}
			/>

			<Button
				text=""
				size="small"
				shape="square"
				icon="/assets/Icons/SearchW.svg"
				className={styles.SearchBtn}
				variant="remote"
				onClick={toggleSearchBar}
			/>

			<Button
				text=""
				size="small"
				shape="square"
				icon="/assets/Icons/Profil.png"
				className={styles.ProfileBtn}
				variant="remote"
				onClick={goToProfile}
			/>

			<Button
				text="EN/FR"
				size="small"
				shape="square"
				className={styles.LangBtn}
				variant="remote"
				onClick={handleChangeLang}
			/>

			<Button
				text="FX"
				size="small"
				shape="square"
				className={styles.FXBtn}
				variant="remote"
				onClick={onToggleFx}
				aria-pressed="false"
			/>

			<Button
				text=""
				size="small"
				shape="square"
				icon="/assets/Icons/LogoutW.svg"
				className={styles.LogoutBtn}
				variant="remote"
				onClick={handleLogout}
			/>

			{showSearch &&
				createPortal(
					<div className={styles.SearchContainer} onClick={closeSearchModal}>
						<div onClick={(e) => e.stopPropagation()}>
							{/* IMPORTANT: nécessite que SearchBar accepte la prop onSubmit */}
							<SearchBar onSubmit={closeSearchModal} />
						</div>
					</div>,
					document.body
				)}
		</div>
	);
}
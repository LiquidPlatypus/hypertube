import { useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Button from "./ui/Button.tsx";
import SearchBar from "./ui/SearchBar.tsx";
import {useTranslation} from "../hooks/useTranslation.tsx";

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
	const { pathname } = useLocation();
	const disableSearch = pathname.startsWith("/profile");


	const goHome = () => {
		navigate("/");
	}

	const showSearchBar = () => {
		if (disableSearch) return;
		setShowSearch((prev) => !prev);
	};


	const closeSearch = () => {
		setShowSearch(false);
	};

	const goToProfile = () => {
		navigate("/profile");
	}

	const handleChangeLang = async () => {
		const newLang = currentLang === "en" ? "fr" : "en";
		await changeLang(newLang);
	}

	const handleLogout = () => {
		try {
			localStorage.removeItem("access_token");
			navigate('/auth/login');
		} catch (error) {
			console.error("Logout failed:", error);
		}
	}
	useEffect(() => {
		if (disableSearch) setShowSearch(false);
	}, [disableSearch]);

	return (
		<div className={styles.TVRemote}>
			<Button
				size="small"
				shape="square"
				icon="assets/Arrow.svg"
				className={`${styles.remoteToggleBtn} ${
					isOpen ? styles.remoteToggleBtnOpen : ""
				}`}
				variant="remote"
				onClick={onToggleRemote}
			/>

			<Button
				size="small"
				shape="square"
				icon="assets/HomeW.svg"
				className={styles.HomeBtn}
				variant="remote"
				onClick={goHome}
			/>
			<Button
				text=""
				size="small"
				shape="square"
				icon="assets/SearchW.svg"
				className={styles.SearchBtn}
				variant="remote"
				onClick={showSearchBar}
			/>
			<Button
				text=""
				size="small"
				shape="square"
				icon="assets/Profil.png"
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
				icon="assets/LogoutW.svg"
				className={styles.LogoutBtn}
				variant="remote"
				onClick={handleLogout}
			/>

			{showSearch && createPortal(
				<div className={styles.SearchContainer}>
					<SearchBar closeSearch={closeSearch} currentLang={currentLang} />
				</div>,
				document.body
			)}
		</div>
	);
}
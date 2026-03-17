import {useNavigate} from "react-router-dom";
import {useEffect, useState} from "react";
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

	const goHome = () => {
		navigate("/");
	}

	const showSearchBar = () => {
		setShowSearch((prev) => !prev);
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
		if (!showSearch) return ;

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") setShowSearch(false);
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [showSearch]);

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

			{showSearch &&
				createPortal(
					<div
						className={styles.SearchContainer}
						onClick={() => setShowSearch(false)}
					>
						<div onClick={(e) => e.stopPropagation()}>
							<SearchBar />
						</div>
					</div>,
					document.body
				)
			}
		</div>
	);
}
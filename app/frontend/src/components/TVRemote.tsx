import {useNavigate} from "react-router-dom";

import Button from "./ui/Button.tsx";
import SearchBar from "./ui/SearchBar.tsx";

import styles from "./TVRemote.module.css";

export default function TVRemote() {
	const navigate = useNavigate();

	const goHome = () => {
		navigate("/");
	}

	const handleSearch = () => {

	};

	const goToProfile = () => {
		navigate("/profile");
	}

	const changeLang = () => {
		
	}

	const handleLogout = () => {
		try {
			localStorage.removeItem("access_token");
			navigate('/auth/login');
		} catch (error) {
			console.error("Error server");
		}
	}

	return (
		<div className={styles.TVRemote}>
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
				onClick={handleSearch}
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
				onClick={changeLang}
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
		</div>
	);
}
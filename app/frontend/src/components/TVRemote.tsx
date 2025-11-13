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
				text="Home"
				size="small"
				shape="square"
				className={styles.HomeBtn}
				variant="remote"
				onClick={goHome}
			/>
			<Button
				text="Search"
				size="small"
				shape="square"
				className={styles.SearchBtn}
				variant="remote"
				onClick={handleSearch}
			/>
			<Button
				text="Profile"
				size="small"
				shape="square"
				className={styles.ProfileBtn}
				variant="remote"
				onClick={goToProfile}
			/>
			<Button
				text="Logout"
				size="small"
				shape="square"
				className={styles.LogoutBtn}
				variant="remote"
				onClick={handleLogout}
			/>

			<div className={styles.SearchContainer}>
				<SearchBar />
			</div>
		</div>
	);
}
import {useState} from "react";
import {useNavigate} from "react-router-dom";

import Button from "./ui/Button.tsx";
import SearchBar from "./ui/SearchBar.tsx";

import styles from "./TVRemote.module.css";

export default function TVRemote() {
	const navigate = useNavigate();
	const [showSearch, setShowSearch] = useState(false);

	const goHome = () => {
		navigate("/");
	}

	const showSearchBar = () => {
		setShowSearch((prev) => !prev);
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
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.HomeBtn}
				onClick={goHome}
			/>
			<Button
				text="Search"
				size="small"
				shape="square"
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.SearchBtn}
				onClick={showSearchBar}
			/>
			<Button
				text="Profile"
				size="small"
				shape="square"
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.ProfileBtn}
				onClick={goToProfile}
			/>
			<Button
				text="Logout"
				size="small"
				shape="square"
				style={{backgroundColor: "#000000", color: "#FFFFFF"}}
				className={styles.LogoutBtn}
				onClick={handleLogout}
			/>

			{showSearch && (
				<div className={styles.SearchContainer}>
					<SearchBar />
				</div>
			)}
		</div>
	);
}
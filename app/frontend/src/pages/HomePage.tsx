import styles from "./HomePage.module.css";

import MainLayout from "../components/layout/MainLayout.tsx";
import { useState } from "react";

export interface User {
	"user": {
		"id": number,
		"username": string,
		"email": string,
		"firstname": string,
		"lastname": string,
	}
}

export default function HomePage() {
	const [user_info, setUserInfo] = useState("");

	const testGetUserInfo = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			const token = localStorage.getItem("access_token");
			const response = await fetch("/api/me", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});
			if (!response.ok) {
				throw new Error("Not authorized");
			}
			const data: User = await response.json();
			console.log(data.user.firstname);
		} catch (error) {
			setUserInfo("Error")
		}
	};
	return (
		<div className={styles.homePage}>
			<h1>{user_info}</h1>
			<button onClick={testGetUserInfo}>Click me</button>
			<MainLayout />
		</div>
	);
}

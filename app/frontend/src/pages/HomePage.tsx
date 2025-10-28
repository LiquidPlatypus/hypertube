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
	const [username, setUsername] = useState("");
	const [email, setEmail] = useState("");
	const [firstname, setFirstname] = useState("");
	const [lastname, setLastname] = useState("");

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

	const testModifyProfile = async (e: React.MouseEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const token = localStorage.getItem("access_token");
			const response = await fetch("/api/modify-profile", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ username, email, firstname, lastname }),
			});
			if (!response.ok) {
				throw new Error("Not authorized");
			}
			const data: {returnValue: Boolean} = await response.json();
			console.log(data.returnValue);
		} catch (error) {
			console.error("Error in modify form");
		}
	};

	return (
		<div className={styles.homePage}>
			<h1>{user_info}</h1>
			{/* <button onClick={testGetUserInfo}>Click me</button> */}

				<form onSubmit={testModifyProfile}>
					<label htmlFor="username">Enter username :</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder="Username"
						required
					/>
					<label htmlFor="email">Enter email :</label>
					<input
						id="email"
						type="text"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="Email"
						required
					/>
					<label htmlFor="firstname">Enter firstname :</label>
					<input
						id="firstname"
						type="text"
						value={firstname}
						onChange={(e) => setFirstname(e.target.value)}
						placeholder="firstname"
						required
					/>
					<label htmlFor="email">Enter lastname :</label>
					<input
						id="lastname"
						type="text"
						value={lastname}
						onChange={(e) => setLastname(e.target.value)}
						placeholder="lastname"
						required
					/>
					<button type="submit">Send</button>
				</form>
				<button onClick={testGetUserInfo}>Click me</button>
			<MainLayout />
		</div>
	);
}

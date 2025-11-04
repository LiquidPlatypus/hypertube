import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
	const [firstname, setFirstname] = useState("");
	const [lastname, setLastname] = useState("");
	const navigate = useNavigate();

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
			console.log(data.user);
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
				body: JSON.stringify({ username, firstname, lastname }),
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

	const testMessage = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			const response = await fetch("/api/hello", {
				method: "GET",
				headers: {
					"Content-Type": "application/json",
				},
			});
			if (!response.ok) {
				throw new Error("Server error");
			}
			const data: {message: string} = await response.json();
			console.log(data.message);
		} catch (error) {
			console.error("Error server");
		}
	};

	const logout = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			localStorage.removeItem("access_token");
			navigate('/auth/login');
		} catch (error) {
			console.error("Error server");
		}
	};

	return (
		<div>
			<button onClick={testMessage}>Hello</button>

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
					<label htmlFor="firstname">Enter firstname :</label>
					<input
						id="firstname"
						type="text"
						value={firstname}
						onChange={(e) => setFirstname(e.target.value)}
						placeholder="firstname"
						required
					/>
					<label htmlFor="lastname">Enter lastname :</label>
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
				<button onClick={logout}>Logout</button>
		</div>
	);
}
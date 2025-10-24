import * as React from "react";
import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

export default function Entry() {
	const navigate = useNavigate();

	return (
		<div>
			<button onClick={() => navigate("/entry/login")}>Login</button>
			<button onClick={() => navigate("/entry/register")}>
				Register
			</button>
			<Outlet />
		</div>
	);
}

export function Login() {
	const navigate = useNavigate();
	const [username, setUsername] = useState<string>("");
	const [password, setPassword] = useState<string>("");

	const loginAccount = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});

			if (!response.ok) {
				throw new Error("Server error");
			}
			const data: { returnValue: boolean } = await response.json();
			console.log(data.returnValue);
			if (data.returnValue) navigate("/");
			else console.error("Wront username or password");
		} catch (error) {
			console.error("Login catch called");
		}
	};

	return (
		<>
			<h2>Login</h2>
			<form onSubmit={loginAccount}>
				<label htmlFor="username">Enter username :</label>
				<input
					id="username"
					type="text"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Username"
					required
				/>
				<label htmlFor="password">Enter password :</label>
				<input
					id="password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Password"
					required
				/>
				<button type="submit">Send</button>
			</form>
		</>
	);
}

export function Register() {
	//	const navigate = useNavigate();
	const [username, setUsername] = useState<string>("");
	const [email, setEmail] = useState<string>("");
	const [password, setPassword] = useState<string>("");
	const [message, setMessage] = useState<string>("");

	const createAccount = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password, email }),
			});

			if (!response.ok) {
				throw new Error("Server error");
			}

			const data: { returnValue: boolean } = await response.json();
			if (data.returnValue) setMessage("Profile create !");
			else throw new Error("This profile can't be created");
		} catch (error) {
			if (typeof error === "string") setMessage(error);
			else if (error instanceof Error) {
				setMessage(error.message);
			}
		}
	};

	return (
		<>
			<h2>Register</h2>
			<form onSubmit={createAccount}>
				<label htmlFor="username">Enter username :</label>
				<input
					id="username"
					type="text"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Username"
					required
				/>
				<label htmlFor="password">Enter password :</label>
				<input
					id="password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Password"
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
				<button type="submit">Send</button>
			</form>
			<p>{message}</p>
		</>
	);
}

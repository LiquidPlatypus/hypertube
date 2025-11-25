import React, { useState } from "react";
import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";
import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
	onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState("");

	const [loginData, setLoginData] = useState({ username: "", password: "" });
	const [registerData, setRegisterData] = useState({
		firstName: "",
		lastName: "",
		username: "",
		email: "",
		password: "",
		confirmPassword: "",
	});

	// Reset functions
	const clearLoginData = () => setLoginData({ username: "", password: "" });
	const clearRegisterData = () =>
		setRegisterData({
			firstName: "",
			lastName: "",
			username: "",
			email: "",
			password: "",
			confirmPassword: "",
		});

	// Login handler
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(loginData),
			});
			if (!response.ok) throw new Error("Incorrect username or password");
			const data = await response.json();
			localStorage.setItem("access_token", data.access_token);
			clearLoginData();
			onLoginSuccess?.();
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		}
	};

	// Register handler
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		if (registerData.password !== registerData.confirmPassword) {
			setMessage("Passwords don't match");
			return;
		}

		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: registerData.username,
					password: registerData.password,
					email: registerData.email,
					firstName: registerData.firstName,
					lastName: registerData.lastName,
				}),
			});

			if (!response.ok) throw new Error("Error during registration");

			const data = await response.json();
			if (data.returnValue) {
				setMessage("Account created successfully! You can now log in.");
				setTimeout(() => {
					setIsLogin(true);
					setMessage("");
					clearRegisterData();
				}, 2000);
			} else {
				setMessage(data.message || "Account creation not possible");
			}
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Error during registration");
		}
	};

	// OAuth handlers (TODO)
	const handleGoogleLogin = () => console.log("TODO: redirect to /api/auth/google");
	const handleIntra42Login = () => console.log("TODO: redirect to /api/auth/intra42");

	return (
		<div className={styles.LoginScreen}>
			<h2 className={styles.LoginTitle}>{isLogin ? "Login" : "Register"}</h2>

			{message && (
				<p
					className={`${styles.Message} ${
						message.includes("success") ? styles.MessageSuccess : styles.MessageError
					}`}
				>
					{message}
				</p>
			)}

			{/* === LOGIN === */}
			{isLogin && (
				<>
					<form className={styles.LoginForm} onSubmit={handleLogin}>
						<Input
							type="text"
							placeholder="Username"
							value={loginData.username}
							onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
							className={styles.Inputs}
							required
						/>
						<Input
							type="password"
							placeholder="Password"
							value={loginData.password}
							onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
							className={styles.Inputs}
							required
						/>
						<Button text="Login" size="large" shape="pill" />
					</form>

					<div className={styles.LoginRegisterBtn}>
						<p>Pas encore de compte ?</p>
						<Button
							text="Register"
							size="large"
							shape="pill"
							onClick={() => {
								setIsLogin(false);
								setMessage("");
							}}
						/>
					</div>

					<div className={styles.OAuthButtons}>
						<Button text="Google" size="large" shape="pill" onClick={handleGoogleLogin} />
						<Button text="Intra 42" size="large" shape="pill" onClick={handleIntra42Login} />
					</div>
				</>
			)}

			{/* === REGISTER === */}
			{!isLogin && (
				<form className={styles.RegisterForm} onSubmit={handleRegister}>
					<Input
						type="text"
						placeholder="First Name"
						value={registerData.firstName}
						onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
						className={styles.Inputs}
						required
					/>
					<Input
						type="text"
						placeholder="Last Name"
						value={registerData.lastName}
						onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
						className={styles.Inputs}
						required
					/>
					<Input
						type="text"
						placeholder="Username"
						value={registerData.username}
						onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
						className={styles.Inputs}
						required
					/>
					<Input
						type="email"
						placeholder="Email"
						value={registerData.email}
						onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
						className={styles.Inputs}
						required
					/>
					<Input
						type="password"
						placeholder="Password"
						value={registerData.password}
						onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
						className={styles.Inputs}
						required
					/>
					<Input
						type="password"
						placeholder="Confirm Password"
						value={registerData.confirmPassword}
						onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
						className={styles.Inputs}
						required
					/>

					<Button text="Register" size="large" shape="pill" />
					<Button
						text="← Back to Login"
						size="large"
						shape="pill"
						onClick={() => {
							setIsLogin(true);
							setMessage("");
							clearRegisterData();
						}}
					/>
				</form>
			)}
		</div>
	);
}

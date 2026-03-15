import React, {useState} from "react";
import {useNavigate} from "react-router-dom";
import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";

import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
	onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
	const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState("");

	const { t } = useTranslation();

	// Login
	const [loginUsername, setLoginUsername] = useState("");
	const [loginPassword, setLoginPassword] = useState("");

	// Register
	const [registerFirstname, setRegisterFirstname] = useState("");
	const [registerLastname, setRegisterLastname] = useState("");
	const [registerUsername, setRegisterUsername] = useState("");
	const [registerEmail, setRegisterEmail] = useState("");
	const [registerPassword, setRegisterPassword] = useState("");
	const [registerPasswordConfirmation, setRegisterPasswordConfirmation] = useState("");

	// TODO: REMOVE AUTOLOG !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
	interface LoginResponse {
		access_token: string;
		token_type: string; // souvent "bearer"
	}

	const autoLog = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			const response = await fetch("/api/auto-log", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok)
				throw new Error("Error during register");
			const data: LoginResponse = await response.json();
			localStorage.setItem("access_token", data.access_token);
			navigate("/");
		} catch (err) {
			console.error(err);
		}
	};

	// Login Handler
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: {"Content-Type": "application/json" },
				body: JSON.stringify({ username: loginUsername, password: loginPassword }),
			})
			if (!response.ok)
				throw new Error(t("login.error.incorrect"));
			const data = await response.json();
			localStorage.setItem("access_token", data.access_token);
			onLoginSuccess?.();
			navigate("/");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		}
	};

	// Register handler
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		if (registerPassword !== registerPasswordConfirmation) {
			setMessage(t("register.error.passwordMismatch"));
			return;
		}
		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: {"Content-Type": "application/json" },
				body: JSON.stringify({
					username: registerUsername,
					password: registerPassword,
					email: registerEmail,
					firstName: registerFirstname,
					lastName: registerLastname,
				}),
			});
			if (!response.ok)
				throw new Error(t("register.error.failed"));
			const data = await response.json();
			if (data.returnValue) {
				setMessage(t("register.success"));
				setTimeout(() => {
					setIsLogin(true);
					setMessage("");
				}, 2000);
			} else {
				setMessage(data.message || t("register.error.notPossible"));
			}
		} catch (error) {
			setMessage(error instanceof Error ? error.message : t("register.error.failed"));
		}
	};

	return (
		<div className={styles.LoginScreen}>
			<h2 className={styles.LoginRegister}>
				{isLogin ? t("login.title") : t("register.title")}
			</h2>

			{message && (
				<p className={`message ${message.includes(t("register.success")) ? "message-success" : "message-error"}`}>
					{message}
				</p>
			)}

			<div className={styles.LoginRegisterBtn}>
				<Button
					text={t("login.button")}
					size="medium"
					shape="pill"
					onClick={() => {setIsLogin(true); setMessage(""); }}
				/>
				<Button
					text={t("register.button")}
					size="medium"
					shape="pill"
					onClick={() => {setIsLogin(false); setMessage(""); }}
				/>
			</div>

			{isLogin ? (
				<form className={styles.LoginForm} onSubmit={handleLogin}>
					<Input
						type="text"
						placeholder={t("login.placeholder.username")}
						value={loginUsername}
						onChange={(e) => setLoginUsername(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Input
						type="password"
						placeholder={t("login.placeholder.password")}
						value={loginPassword}
						onChange={(e) => setLoginPassword(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Button text={t("login.submit")} size="large" shape="pill" />
					<button onClick={autoLog}>auto-log</button>
				</form>
			) : (
				<form className={styles.RegisterForm} onSubmit={handleRegister}>
					<Input
						type="text"
						placeholder={t("register.placeholder.firstname")}
						value={registerFirstname}
						onChange={(e) => setRegisterFirstname(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Input
						type="text"
						placeholder={t("register.placeholder.lastname")}
						value={registerLastname}
						onChange={(e) => setRegisterLastname(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Input
						type="text"
						placeholder={t("register.placeholder.username")}
						value={registerUsername}
						onChange={(e) => setRegisterUsername(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Input
						type="email"
						placeholder={t("register.placeholder.email")}
						value={registerEmail}
						onChange={(e) => setRegisterEmail(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Input
						type="password"
						placeholder={t("register.placeholder.password")}
						value={registerPassword}
						onChange={(e) => setRegisterPassword(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Input
						type="password"
						placeholder={t("register.placeholder.confirmPassword")}
						value={registerPasswordConfirmation}
						onChange={(e) => setRegisterPasswordConfirmation(e.target.value)}
						className={styles.Inputs}
						required
					/>
					<Button text={t("register.submit")} size="large" shape="pill" />
				</form>
			)}
		</div>
	);
}
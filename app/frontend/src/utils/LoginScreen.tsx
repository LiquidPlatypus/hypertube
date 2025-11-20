import React, { useState } from "react";
import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";
import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
	onLoginSuccess?: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
	// const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState("");

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

	// Login handler
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username: loginUsername, password: loginPassword }),
			});
			if (!response.ok)
				throw new Error("Incorrect username or password");
			const data = await response.json();
			localStorage.setItem("access_token", data.access_token);
			onLoginSuccess?.();
			// navigate("/");
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		}
	};

	// Register handler
	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");

		if (registerPassword !== registerPasswordConfirmation) {
			setMessage("Passwords don't match");
			return;
		}

		try {
			const response = await fetch("/api/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: registerUsername,
					password: registerPassword,
					email: registerEmail,
					firstName: registerFirstname,
					lastName: registerLastname,
				}),
			});

			if (!response.ok)
				throw new Error("Error during registration");

			const data = await response.json();
			if (data.returnValue) {
				setMessage("Account created successfully! You can now log in.");
				setTimeout(() => {
					setIsLogin(true);
					setMessage("");
				}, 2000);
			} else {
				setMessage(data.message || "Account creation not possible");
			}
		} catch (error) {
			setMessage(error instanceof Error ? error.message : "Error during registration");
		}
	};

	// Future OAuth handlers
	const handleGoogleLogin = () => {
		console.log("TODO: redirect to /api/auth/google");
	};

	const handleIntra42Login = () => {
		console.log("TODO: redirect to /api/auth/intra42");
	};

	return (
		<div className={styles.LoginScreen}>
			<h2 className={styles.LoginTitle}>
				{isLogin ? "Login" : "Register"}
			</h2>

			{message && (
				<p className={`${styles.Message} ${message.includes("success") ? styles.MessageSuccess : styles.MessageError}`}>
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
							value={loginUsername}
							onChange={(e) => setLoginUsername(e.target.value)}
							className={styles.Inputs}
							required
						/>
						<Input
							type="password"
							placeholder="Password"
							value={loginPassword}
							onChange={(e) => setLoginPassword(e.target.value)}
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
							onClick={() => { setIsLogin(false); setMessage(""); }}
						/>
					</div>

					<div className={styles.OAuthButtons}>
						<Button
							text="Login with Google"
							size="large"
							shape="pill"
							onClick={handleGoogleLogin}
						/>
						<Button
							text="Login with Intra 42"
							size="large"
							shape="pill"
							onClick={handleIntra42Login}
						/>
					</div>
				</>
			)}

			{/* === REGISTER === */}
			{!isLogin && (
				<div className={styles.RegisterContainer}>
					<form className={styles.RegisterForm} onSubmit={handleRegister}>
						<Input type="text" placeholder="First Name" value={registerFirstname}
							onChange={(e) => setRegisterFirstname(e.target.value)} className={styles.Inputs} required />
						<Input type="text" placeholder="Last Name" value={registerLastname}
							onChange={(e) => setRegisterLastname(e.target.value)} className={styles.Inputs} required />
						<Input type="text" placeholder="Username" value={registerUsername}
							onChange={(e) => setRegisterUsername(e.target.value)} className={styles.Inputs} required />
						<Input type="email" placeholder="Email" value={registerEmail}
							onChange={(e) => setRegisterEmail(e.target.value)} className={styles.Inputs} required />
						<Input type="password" placeholder="Password" value={registerPassword}
							onChange={(e) => setRegisterPassword(e.target.value)} className={styles.Inputs} required />
						<Input type="password" placeholder="Confirm Password" value={registerPasswordConfirmation}
							onChange={(e) => setRegisterPasswordConfirmation(e.target.value)} className={styles.Inputs} required />

						<Button text="Register" size="large" shape="pill" />
						<Button
							text="← Back to Login"
							size="large"
							shape="pill"
							onClick={() => { setIsLogin(true); setMessage(""); }}
						/>
					</form>
				</div>
			)}
		</div>
	);
}
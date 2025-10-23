import Button from "../components/ui/Button.tsx";
import { useState } from "react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import styles from "./LoginPage.module.css";

export default function LoginPage() {
	const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState(true); // true = Login, false = Register

	// Etats pour le formulaire de login
	const [loginUsername, setLoginUsername] = useState("");
	const [loginPassword, setLoginPassword] = useState("");

	// Etats pour le formulaire de register
	const [registerFirstname, setRegisterFirstname] = useState("");
	const [registerLastname, setRegisterLastname] = useState("");
	const [registerUsername, setRegisterUsername] = useState("");
	const [registerEmail, setRegisterEmail] = useState("");
	const [registerPassword, setRegisterPassword] = useState("");
	const [registerPasswordConfirmation, setRegisterPasswordConfirmation] = useState("");
	const [registerProfilePic, setRegisterProfilePic] = useState<File | null>(null)

	// Etats pour les messages error/success
	const [message, setMessage] = useState("");

	const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setMessage(""); // reset le message

		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					username: loginUsername,
					password: loginPassword,
				}),
			});

			if (!response.ok) {
				throw new Error("Error server during login")
			}

			const data: { returnValue: boolean; token?: any } = await response.json();

			if (data.returnValue) {
				// si serveur renvoie un token, on le stock
				// TODO: adapter en fonction de l'API
				localStorage.setItem("authToken", data.token);

				// Redirect vers page d'acceuil
				navigate("/");
			} else {
				setMessage("Username or password incorrect");
			}
		} catch (error) {
			console.error("Error during login", error);
			setMessage("Error during login. Please try again.");
		}
	};

	const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setMessage(""); // Reset message

		// Verif  que les mdp correspondent
		if (registerPassword !== registerPasswordConfirmation) {
			setMessage("Password don't match");
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
					// rajouter profilePic avec FormData
				}),
			});

			if (!response.ok) {
				throw new Error("Error during register");
			}

			const data: { returnValue: boolean; message?: string } = await response.json();

			if (data.returnValue) {
				setMessage("Account successfully registered! You can now log in.");
				// TODO: redict auto vers login
				setTimeout(() => {
					setIsLogin(true);
					setMessage("");
				}, 2000);
			} else {
				setMessage(data.message || "Cannot create account");
			}
		} catch (error) {
			console.error("Error during register", error);
			if (error instanceof Error) {
				setMessage(error.message);
			} else {
				setMessage("error during register. Please try again.");
			}
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<div className={styles.buttonContainer}>
					<Button
						text="Login"
						size="large"
						shape="square"
						onClick={() => {
							setIsLogin(true);
							setMessage("");
						}}
					/>
					<Button
						text="Register"
						size="large"
						shape="square"
						onClick={() => {
							setIsLogin(false);
							setMessage("");
						}}
					/>
				</div>

				{message && (
					<p className={styles.message} style={{
						color: message.includes("success") ? "green" : "red",
						textAlign: "center",
						marginTop: "1rem"
					}}>
						{message}
					</p>
				)}

				{isLogin ? (
					// Formulaire de connexion
					<form className={styles.form} onSubmit={handleLogin}>
						<div className={styles.login}>
							<div>
								<label htmlFor="username">Username: </label>
								<input
									type="text"
									name="username"
									id="username"
									value={loginUsername}
									onChange={(e) => setLoginUsername(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="password">Password: </label>
								<input
									type="password"
									name="password"
									id="password"
									value={loginPassword}
									onChange={(e) => setLoginPassword(e.target.value)}
									required
								/>
							</div>
							<Button text="Login" size="large" shape="square" />
						</div>
					</form>
				) : (
					// Formulaire d'inscription
					<form className={styles.form} onSubmit={handleRegister}>
						<div className={styles.register}>
							<div>
								<label htmlFor="firstname">First name: </label>
								<input
									type="text"
									name="firstname"
									id="firstname"
									value={registerFirstname}
									onChange={(e) => setRegisterFirstname(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="lastname">Last name: </label>
								<input
									type="text"
									name="lastname"
									id="lastname"
									value={registerLastname}
									onChange={(e) => setRegisterLastname(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="register-username">Username: </label>
								<input
									type="text"
									name="username"
									id="register-username"
									value={registerUsername}
									onChange={(e) => setRegisterUsername(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="email">Email: </label>
								<input
									type="email"
									name="email"
									id="email"
									value={registerEmail}
									onChange={(e) => setRegisterEmail(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="register-password">Password: </label>
								<input
									type="password"
									name="password"
									id="register-password"
									value={registerPassword}
									onChange={(e) => setRegisterPassword(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="password_confirmation">
									Confirm Password:{" "}
								</label>
								<input
									type="password"
									name="password_confirmation"
									id="password_confirmation"
									value={registerPasswordConfirmation}
									onChange={(e) => setRegisterPasswordConfirmation(e.target.value)}
									required
								/>
							</div>
							<div>
								<label htmlFor="profilepic">
									Profile picture:{" "}
								</label>
								<input
									type="file"
									name="profilepic"
									id="profilepic"
									accept="image/*"
									onChange={(e) => setRegisterProfilePic(e.target.files?.[0] || null)}
								/>
							</div>
							<Button
								text="Register"
								size="large"
								shape="square"
							/>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}

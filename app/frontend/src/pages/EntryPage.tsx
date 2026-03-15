import { useState } from "react";
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { GoogleOAuthProvider, GoogleLogin, type GoogleCredentialResponse } from "@react-oauth/google";

export default function EntryPage() {
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

	// Etats pour les messages error/success
	const [message, setMessage] = useState("");

	interface LoginResponse {
		access_token: string;
		token_type: string; // souvent "bearer"
	}

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
				throw new Error("Invalid Password or username")
			}

			const data: LoginResponse = await response.json();
			localStorage.setItem("access_token", data.access_token);
			navigate("/");

		} catch (error) {
			if (typeof error === "string") setMessage(error);
			else if (error instanceof Error) {
				setMessage(error.message);
			}
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

	const emailSend = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		try {
			const response = await fetch(`/api/send-email`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: registerEmail,
				}),
			});
			if (!response.ok)
				throw new Error("Server error");
			const data: {returnValue: boolean} = await response.json();
			if (data.returnValue === false)
				setMessage("email not exist");
			else
				setMessage("email send");
		} catch (err) {
			console.error(err);
		}
	};

	const handleGoogleLogin = async (credentialResponse: GoogleCredentialResponse) => {
		try {
			const token = credentialResponse.credential;
			const response = await fetch(`/api/google-auth`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					token,
				}),
			});
			if (!response.ok) {
				const err = await response.json();
				if (response.status === 418)
					setMessage(err.detail);
				throw new Error(err);
			}
			const data: LoginResponse = await response.json();
			localStorage.setItem("access_token", data.access_token);
			navigate("/");
		} catch (error) {
			console.error(error);
		}
	}

	return (
		<div>

				
					<button onClick={() => navigate(`/thumbnails`)}>Thumbnails</button>
				
				
				<GoogleOAuthProvider clientId="504765868462-ssreveurjgq1i8tuoinem6fcp0g8kv90.apps.googleusercontent.com">
					<GoogleLogin
						onSuccess={handleGoogleLogin}
						onError={() => console.error("Google Auth Failed")}
					/>
				</GoogleOAuthProvider>
				<form onSubmit={emailSend}>
					<label htmlFor="email">Email: </label>
					<input
						type="text"
						name="email"
						id="email"
						value={registerEmail}
						onChange={(e) => setRegisterEmail(e.target.value)}
						required
					/>
					<button type="submit">Send reset password email</button>
				</form>
				<button onClick={autoLog}>auto-log</button>
				<div>
                    <button onClick={() => {
							setIsLogin(true);
							setMessage("");
						}}>Login</button>
                    <button onClick={() => {
							setIsLogin(false);
							setMessage("");
						}}>Register</button>
				</div>

				{message && (
					<p>
						{message}
					</p>
				)}

				{isLogin ? (
					// Formulaire de connexion
					<form onSubmit={handleLogin}>
						<div>
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
                            <button type="submit">Login</button>
						</div>
					</form>
				) : (
					// Formulaire d'inscription
					<form onSubmit={handleRegister}>
						<div>
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
                            <button type="submit">Register</button>
						</div>
					</form>
				)}
			</div>
	);
};

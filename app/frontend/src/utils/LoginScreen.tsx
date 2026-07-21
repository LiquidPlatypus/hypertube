import React, {useMemo, useState} from "react";

import { GoogleOAuthProvider, GoogleLogin, type GoogleCredentialResponse } from "@react-oauth/google";

import Button from "../components/ui/Button.tsx";
import Input from "../components/ui/Input.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";
import { clearWatched } from "./watchedSession.ts";

import styles from "./LoginScreen.module.css";
import {useNavigate, useSearchParams} from "react-router-dom";
import {useEffect} from "react";

interface LoginScreenProps {
	onLoginSuccess?: () => void;
}

type LoginData = {
	username: string;
	password: string;
};

type RegisterData = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	password: string;
	confirmPassword: string;
}

type ApiAuthResponse = {
	access_token: string;
	token_type?: string;
}

const FT_AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize";

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();

	const [isLogin, setIsLogin] = useState(true);
	const [message, setMessage] = useState<string>("");
	const [isLoading, setIsLoading] = useState(false);
	
	const [searchParams] = useSearchParams();
	const [isCalled, setIsCalled] = useState(false);

	const emptyLoginData = useMemo<LoginData>(() => ({ username: "", password: "" }), []);
	const emptyRegisterData = useMemo<RegisterData>(
		() => ({
			firstName: "",
			lastName: "",
			username: "",
			email: "",
			password: "",
			confirmPassword: "",
		}),
		[]
	);

	const [loginData, setLoginData] = useState<LoginData>(emptyLoginData);
	const [registerData, setRegisterData] = useState<RegisterData>(emptyRegisterData);

	// Reset helpers
	const clearLoginData = () => setLoginData(emptyLoginData);
	const clearRegisterData = () => setRegisterData(emptyRegisterData);

	// Small helpers
	const setErrorMessage = (err: unknown, fallback: string) => {
		if (!(err instanceof Error)) {
			setMessage(fallback);
			return;
		}

		const msg = (err.message ?? "").trim();

		if (!msg || msg === "Error" || msg === "Error:" || msg === "Failed to fetch") {
			setMessage(fallback);
			return;
		}

		setMessage(msg);
	};

	// post-auth uniforme
	const finishAuth = (accessToken: string) => {
		localStorage.setItem("access_token", accessToken);
		clearWatched();  // fresh session — don't inherit another user's badges
		onLoginSuccess?.();
	};

	// Wrapper fetch JSON
	const postJson = async <TResponse, TBody extends object>(url: string, body: TBody): Promise<TResponse> => {
		const res = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!res.ok) {
			try {
				const err = await res.json();
				const detail = typeof err?.detail === "string" ? err.detail : undefined;
				throw new Error(detail ?? t("error"));
			} catch {
				throw new Error(t("error"));
			}
		}

		return res.json();
	};

	// Handlers
	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");
		setIsLoading(true);

		try {
			const data = await postJson<ApiAuthResponse, LoginData>("/api/login", loginData);
			clearLoginData();
			finishAuth(data.access_token);
		} catch (err) {
			setErrorMessage(err, t("login.error.incorrect"));
		} finally {
			setIsLoading(false);
		}
	};

	const handleRegister = async (e: React.FormEvent) => {
		e.preventDefault();
		setMessage("");
		setIsLoading(true);

		if (registerData.password !== registerData.confirmPassword) {
			setMessage(t("register.error.passwordMismatch"));
			setIsLoading(false);
			return;
		}

		try {
			const payload = {
				provider: "register",
				username: registerData.username,
				password: registerData.password,
				email: registerData.email,
				firstName: registerData.firstName,
				lastName: registerData.lastName,
			};

			const data: any = await postJson<any, typeof payload>("/api/oauth/token", payload);

			if (data?.access_token) {
				setMessage(t("register.success"));
				setTimeout(() => {
					setIsLogin(true);
					setMessage("");
					clearRegisterData();
					finishAuth(data.access_token);
				}, 2000);
			} else {
				setMessage(data?.message || t("register.error.notPossible"));
			}
		} catch (err) {
			setErrorMessage(err, t("register.error.failed"));
		} finally {
			setIsLoading(false);
		}
	};

	// OAuth Google
	const handleGoogleLogin = async (credentialResponse: GoogleCredentialResponse) => {
		setMessage("");

		const credential = credentialResponse.credential;
		if (!credential) return;

		setIsLoading(true);
		try {
			const data = await postJson<ApiAuthResponse, { provider: string; token: string }>(
				"/api/oauth/token", 
				{ provider: "google", token: credential }
			);
			finishAuth(data.access_token);
		} catch (err) {
			setErrorMessage(err, t("login.error.oauth", { defaultValue: "Erreur OAuth" }));
		} finally {
			setIsLoading(false);
		}
	};

	const handleIntra42Login = () => {
		setMessage("");

		const clientId = import.meta.env.VITE_FT_CLIENT_ID;
		const redirectUri = import.meta.env.VITE_FT_REDIRECT_URI;
		if (!clientId || !redirectUri) {
			return setMessage(t("login.error.ftConfigMissing"));
		}

		const state = crypto.randomUUID();
		sessionStorage.setItem("ft_oauth_state", state);
		const params = new URLSearchParams({
			client_id: clientId,
			redirect_uri: redirectUri,
			response_type: "code",
			scope: "public",
			state
		});

		window.location.href = `${FT_AUTHORIZE_URL}?${params.toString()}`;
	};

	useEffect(() => {       
		const code = searchParams.get("code");
		if (code) {
			const login42 = async () => {
				if (isCalled) return;
				setIsCalled(true);
				try {
					const data = await postJson<ApiAuthResponse, { provider: string; token: string }>(
						"/api/oauth/token", 
						{ provider: "42", token: code }
					);
					finishAuth(data.access_token);
					navigate("/");
				} catch (err) {
					if (!sessionStorage.getItem("access_token"))
						console.error(err);
				} finally {
					setIsCalled(false);
				}
			};

			login42();
		}
	}, [searchParams, navigate]);

	// Google client id (env)
	const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

	return (
		<div className={styles.LoginScreen}>
			<h2 className={styles.LoginRegister}>
				{isLogin ? t("login.title") : t("register.title")}
			</h2>

			{message && (
				<p
					className={[
						styles.Message,
						message.includes(t("register.success")) ? styles.MessageSuccess : styles.MessageError,
					].join(" ")}
				>
					{message}
				</p>
			)}

			<div className={styles.LoginRegisterBtn}>
				<Button
					text={t("login.button")}
					size="medium"
					shape="pill"
					onClick={() => {
						setIsLogin(true);
						setMessage("");
					}}
				/>
				<Button
					text={t("register.button")}
					size="medium"
					shape="pill"
					onClick={() => {
						setIsLogin(false);
						setMessage("");
					}}
				/>
			</div>

			{isLogin ? (
				<>
					<form className={styles.LoginForm} onSubmit={handleLogin}>
						<Input
							type="text"
							placeholder={t("login.placeholder.username")}
							value={loginData.username}
							onChange={(e) => setLoginData((p) => ({ ...p, username: e.target.value }))}
							className={styles.Inputs}
							required
							name="username"
							autoComplete="username"
						/>

						<Input
							type="password"
							placeholder={t("login.placeholder.password")}
							value={loginData.password}
							onChange={(e) => setLoginData((p) => ({ ...p, password: e.target.value }))}
							className={styles.Inputs}
							required
							name="password"
							autoComplete="current-password"
						/>

						<button
							type="button"
							className={styles.ForgotPasswordLink}
							onClick={() => {
								navigate("/auth/login/forgot-password");
							}}
							disabled={isLoading}
						>
							{t("login.forgotPassword")}
						</button>

						<button
							type="button"
							className={styles.ForgotPasswordLink}
							onClick={() => {
								navigate("/public-home")
							}}
						>
							{t("login.publicHome")}
						</button>

						<Button
							text={isLoading ? t("loading", { defaultValue: "..." }) : t("login.submit")}
							size="large"
							shape="pill"
							type="submit"
						/>
					</form>

					<div className={styles.OAuthButtons}>
						{googleClientId ? (
							<div className={styles.GoogleWrapper}>
								<GoogleOAuthProvider clientId={googleClientId}>
									<GoogleLogin
										onSuccess={handleGoogleLogin}
										onError={() => setMessage(t("login.error.oauth"))}
										theme="filled_black"
										size="large"
										shape="pill"
										logo_alignment="left"
									/>
								</GoogleOAuthProvider>
							</div>
						) : (
							<p className={[styles.Message, styles.MessageError].join(" ")}>
								{t("login.error.googleConfigMissing")}
							</p>
						)}

						<Button
							text={t("login.intra42", { defaultValue: "Intra 42" })}
							size="large"
							shape="pill"
							onClick={handleIntra42Login}
							className={styles.FtButton}
						/>
					</div>
				</>
			) : (
				<form className={styles.RegisterForm} onSubmit={handleRegister}>
					<Input
						type="text"
						placeholder={t("register.placeholder.firstname")}
						value={registerData.firstName}
						onChange={(e) => setRegisterData((p) => ({ ...p, firstName: e.target.value }))}
						className={styles.Inputs}
						required
						name="firstName"
						autoComplete="given-name"
					/>
					<Input
						type="text"
						placeholder={t("register.placeholder.lastname")}
						value={registerData.lastName}
						onChange={(e) => setRegisterData((p) => ({ ...p, lastName: e.target.value }))}
						className={styles.Inputs}
						required
						name="lastName"
						autoComplete="family-name"
					/>
					<Input
						type="text"
						placeholder={t("register.placeholder.username")}
						value={registerData.username}
						onChange={(e) => setRegisterData((p) => ({ ...p, username: e.target.value }))}
						className={styles.Inputs}
						required
						name="username"
						autoComplete="username"
					/>
					<Input
						type="email"
						placeholder={t("register.placeholder.email")}
						value={registerData.email}
						onChange={(e) => setRegisterData((p) => ({ ...p, email: e.target.value }))}
						className={styles.Inputs}
						required
						name="email"
						autoComplete="email"
					/>
					<Input
						type="password"
						placeholder={t("register.placeholder.password")}
						value={registerData.password}
						onChange={(e) => setRegisterData((p) => ({ ...p, password: e.target.value }))}
						className={styles.Inputs}
						required
						name="new-password"
						autoComplete="new-password"
					/>
					<Input
						type="password"
						placeholder={t("register.placeholder.confirmPassword")}
						value={registerData.confirmPassword}
						onChange={(e) => setRegisterData((p) => ({ ...p, confirmPassword: e.target.value }))}
						className={styles.Inputs}
						required
						name="confirmPassword"
						autoComplete="new-password"
					/>

					<Button
						text={isLoading ? t("loading", { defaultValue: "..." }) : t("register.submit")}
						size="large"
						shape="pill"
						type="submit"
					/>
				</form>
			)}
		</div>
	);
}
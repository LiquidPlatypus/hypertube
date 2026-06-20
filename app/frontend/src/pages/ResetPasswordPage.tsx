import React, { useState } from "react";
import { useParams } from "react-router-dom";

import Input from "../components/ui/Input.tsx";
import Button from "../components/ui/Button.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";
import styles from "./FgPasswordPage.module.css";

export default function ResetPasswordPage() {
	const { t } = useTranslation();

	const { token } = useParams<{ token: string }>();

	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");

	const changePassword = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();

		if (!token) {
			console.error("Token manquant dans l'URL");
			return;
		}

		if (password !== confirmPassword) {
			console.error("Les mots de passe ne correspondent pas");
			return;
		}

		try {
			const response = await fetch("/api/reset-forgot-password", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ newpassword: password }),
			});

			if (!response.ok) throw new Error(`Server Error : ${response.status}`);

			const res = await response.json();
			console.log(res);
		} catch (error) {
			console.error(error);
		}
	};

	return (
		<div className={styles.Wrapper}>
			<p className={styles.Text}>{t("newPassword")}</p>

			<form className={styles.Form} onSubmit={changePassword}>
				<Input
					type="password"
					placeholder={t("register.placeholder.password")}
					value={password}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
						setPassword(e.target.value);
					}}
					className={styles.Inputs}
					required
					name="password"
					autoComplete="new-password"
				/>

				<Input
					type="password"
					placeholder={t("register.placeholder.confirmPassword")}
					value={confirmPassword}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
						setConfirmPassword(e.target.value);
					}}
					className={styles.Inputs}
					required
					name="confirmPassword"
					autoComplete="new-password"
				/>

				<Button text={t("send")} size="large" shape="pill" type="submit" />
			</form>
		</div>
	);
}
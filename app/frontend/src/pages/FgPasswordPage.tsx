import Input from "../components/ui/Input.tsx";
import Button from "../components/ui/Button.tsx";

import { useTranslation } from "../hooks/useTranslation.tsx";
import styles from "./FgPasswordPage.module.css";
import { useState } from "react";

export default function FgPassword() {
	const { t } = useTranslation();
	const [email, setEmail] = useState("");

	async function sendMail(userEmail: string) {
		try {
			const response = await fetch("/api/reset-email", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email: userEmail }),
			});

			if (!response.ok) {
				throw new Error(`Server Error : ${response.status}`);
			}
		} catch (error) {
			console.error(error);
		}
	}

	async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		await sendMail(email);
	}

	return (
		<div className={styles.Wrapper}>
			<p className={styles.Text}>{t("passwordResetText")}</p>

			<form className={styles.Form} onSubmit={onSubmit}>
				<Input
					type="email"
					placeholder={t("register.placeholder.email")}
					value={email}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
						setEmail(e.target.value);
					}}
					className={styles.Inputs}
					required
					name="email"
					autoComplete="email"
				/>

				<Button text={t("send")} size="large" shape="pill" type="submit" />
			</form>
		</div>
	);
}
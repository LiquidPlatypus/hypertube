import Input from "../components/ui/Input.tsx";
import Button from "../components/ui/Button.tsx";

import {useTranslation} from "../hooks/useTranslation.tsx";
import styles from "./FgPasswordPage.module.css";

export default function ResetPasswordPage() {
	const { t } = useTranslation();

	return (
		<div className={styles.Wrapper}>
			<p className={styles.Text}>{t("newPassword")}</p>
			<form className={styles.Form}>
				<Input
					type="password"
					placeholder={t("register.placeholder.password")}
					value=""
					onChange={() => {

					}}
					className={styles.Inputs}
					required
					name="password"
					autoComplete="new-password"
				/>
				<Input
					type="password"
					placeholder={t("register.placeholder.confirmPassword")}
					value=""
					onChange={() => {

					}}
					className={styles.Inputs}
					required
					name="confirmPassword"
					autoComplete="new-password"
				/>

				<Button
					text={t("send")}
					size="large"
					shape="pill"
					type="submit"
				/>
			</form>
		</div>
	);
}
import Button from "../components/ui/Button.tsx";

import styles from "./LoginPage.module.css";

export default function LoginPage() {
	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<div className={styles.buttonContainer}>
					<Button text="Login" size="large" shape="square" />
					<Button text="Register" size="large" shape="square" />
				</div>
				<form className={styles.form}>
					<div>
						<label htmlFor="username">Username: </label>
						<input
							type="text"
							name="username"
							id="username"
							required
						/>
					</div>
					<div>
						<label htmlFor="password">Password: </label>
						<input
							type="password"
							name="password"
							id="password"
							required
						/>
					</div>
				</form>
			</div>
		</div>
	);
}

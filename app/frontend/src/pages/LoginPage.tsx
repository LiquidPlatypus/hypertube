import Button from "../components/ui/Button.tsx";
import { useState } from "react";

import styles from "./LoginPage.module.css";

export default function LoginPage() {
	const [isLogin, setIsLogin] = useState(true); // true = Login, false = Register

	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<div className={styles.buttonContainer}>
					<Button
						text="Login"
						size="large"
						shape="square"
						onClick={() => setIsLogin(true)}
					/>
					<Button
						text="Register"
						size="large"
						shape="square"
						onClick={() => setIsLogin(false)}
					/>
				</div>

				<form className={styles.form}>
					{isLogin ? (
						// Login
						<div className={styles.login}>
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
							<Button text="Login" size="large" shape="square" />
						</div>
					) : (
						// Register
						<div className={styles.register}>
							<div>
								<label htmlFor="firstname">First name: </label>
								<input
									type="text"
									name="firstname"
									id="firstname"
									required
								/>
							</div>
							<div>
								<label htmlFor="lastname">Last name: </label>
								<input
									type="text"
									name="lastname"
									id="lastname"
									required
								/>
							</div>
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
								<label htmlFor="email">Email: </label>
								<input
									type="email"
									name="email"
									id="email"
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
							<div>
								<label htmlFor="password_confirmation">
									Confirm Password:{" "}
								</label>
								<input
									type="password"
									name="password_confirmation"
									id="password"
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
								/>
							</div>
							<Button
								text="Register"
								size="large"
								shape="square"
							/>
						</div>
					)}
				</form>
			</div>
		</div>
	);
}

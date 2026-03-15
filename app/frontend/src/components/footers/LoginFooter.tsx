import styles from "./LoginFooter.module.css";

export default function LoginFooter() {
	return (
		<footer className={styles.Footer}>
			<h1 className={styles.Title}>RetroTube TV</h1>

			{/* Scanlines overlay */}
			<div className={styles.ScanLine}></div>

			{/* Glow */}
			<div className={styles.Glow}></div>

			<div className={styles.Freepik}>
				<p>
					TV Designed by{" "}
					<a
						href="http://www.freepik.com/"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-500 hover:underline"
					>
						Freepik
					</a>
				</p>
			</div>

		</footer>
	);
}
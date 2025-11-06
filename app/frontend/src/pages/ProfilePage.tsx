import styles from "./ProfilePage.module.css";

export default function ProfilePage() {
	return (
		<div className={styles.container}>
			<img src="src/assets/test/pp.png" alt="Profile picture" className={styles.profilePic} />
			<ul>
				<li><h3>Username: </h3><p>liquidplatypus</p></li>
				<li><h3>First name: </h3><p>thibaut</p></li>
				<li><h3>Last name: </h3><p>bournonville</p></li>
				<li><h3>Email: </h3><p>thib.bou@mail.com</p></li>
			</ul>
		</div>
	);
}
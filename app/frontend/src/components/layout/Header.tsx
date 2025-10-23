import styles from "./Header.module.css";
import ImageButton from "../ui/ImageButton.tsx";

import * as React from "react";
import Popup from "../ui/Popup.tsx";

export default function Header() {
	const [anchor, setAnchor] = React.useState<null | HTMLElement>(null);

	const handleProfileClick = (e: React.MouseEvent<HTMLElement>) => {
		setAnchor(anchor ? null : e.currentTarget);
	}

	const handleClose = () => setAnchor(null);

	const open = Boolean(anchor);

	return (
		<header className={styles.container}>
			<h1 id={styles.title}>Ok.Tube</h1>
			<input type="text" id="Search" name="Search" placeholder="Search" />
			<ImageButton
				icon="src/assets/test/pp.png"
				onClick={handleProfileClick}
				size="medium"
				style={{ borderRadius: "50%" }}
			/>
			{open && <Popup anchor={anchor} onClose={handleClose} />}
		</header>
	);
}

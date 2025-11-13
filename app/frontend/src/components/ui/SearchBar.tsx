import Input from "./Input.tsx";

import styles from "./SearchBar.module.css";

export default function SearchBar() {
	return (
		<div>
			<Input
				type="text"
				placeholder="Search"
				size="medium"
				shape="square"
				style={{borderRadius: "7px"}}
				className={styles.SearchBar}
				required
			/>
		</div>
	);
}
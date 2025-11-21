import { useState } from "react";
import Input from "./Input.tsx";

import styles from "./SearchBar.module.css";

export default function SearchBar() {
	const [searchValue, setSearchValue] = useState("");

	return (
		<div>
			<Input
				type="text"
				placeholder="Search"
				size="large"
				shape="square"
				style={{ width: "30rem" }}
				className={styles.SearchBar}
				value={searchValue}
				onChange={(e) => setSearchValue(e.target.value)}
				required
			/>
		</div>
	);
}
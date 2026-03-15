import { useState } from "react";
import Input from "./Input.tsx";
import { useSearch } from "../../utils/searchContext.tsx";

import styles from "./SearchBar.module.css";

export default function SearchBar() {
	const { searchTerm, setSearchTerm } = useSearch();

	return (
		<div>
			<Input
				type="text"
				placeholder="Search"
				size="large"
				shape="square"
				style={{ width: "30rem" }}
				className={styles.SearchBar}
				value={searchTerm}
				onChange={(e) => setSearchTerm(e.target.value)}
				required
			/>
		</div>
	);
}
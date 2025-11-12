import Input from "./Input.tsx";

import styles from "./SearchBar.module.css";

export default function SearchBar() {
	return (
		<div>
			<Input
				type="text"
				placeholder="Search"
				size="large"
				shape="square"
				required
			/>
		</div>
	);
}
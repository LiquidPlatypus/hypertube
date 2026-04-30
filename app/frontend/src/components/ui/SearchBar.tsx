import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import Input from "./Input.tsx";
import { useSearch } from "../../utils/searchContext.tsx";

import styles from "./SearchBar.module.css";

type SearchBarProps = {
	onSubmit?: () => void;
};

export default function SearchBar({ onSubmit }: SearchBarProps) {
	const { searchTerm, setSearchTerm } = useSearch();
	const [draft, setDraft] = useState(searchTerm);

	const navigate = useNavigate();
	const { pathname } = useLocation();

	useEffect(() => {
		setDraft(searchTerm);
	}, [searchTerm]);

	const submitSearch = () => {
		const q = draft.trim();
		setSearchTerm(q);

		if (pathname !== "/" && q.length > 0) {
			navigate("/");
		}
	};

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				submitSearch();
				onSubmit?.();
			}}
		>
			<Input
				autoFocus
				type="text"
				placeholder="Search"
				size="large"
				shape="square"
				style={{ width: "30rem" }}
				className={styles.SearchBar}
				value={draft}
				onChange={(e) => setDraft(e.target.value)}
				required
			/>
		</form>
	);
}
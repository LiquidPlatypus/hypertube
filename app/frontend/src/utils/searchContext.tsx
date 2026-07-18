import { createContext, useContext, useMemo, useState } from "react";

interface SearchContextType {
	searchTerm: string;
	setSearchTerm: (value: string) => void;
	resetSearch: () => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
	const [searchTerm, setSearchTerm] = useState("");

	const value = useMemo<SearchContextType>(() => ({
		searchTerm,
		setSearchTerm,
		resetSearch: () => setSearchTerm(""),
	}), [searchTerm]);

	return (
		<SearchContext.Provider value={value}>
			{children}
		</SearchContext.Provider>
	);
}

export function useSearch() {
	const ctx = useContext(SearchContext);
	if (!ctx) {
		throw new Error("useSearch must be used inside SearchProvider");
	}
	return ctx;
}
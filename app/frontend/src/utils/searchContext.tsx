import { createContext, useContext, useState } from "react";

interface SearchContextType {
	searchTerm: string;
	setSearchTerm: (value: string) => void;
}

const SearchContext = createContext<SearchContextType | null>(null);

export function SearchProvider({ children }: { children: React.ReactNode }) {
	const [searchTerm, setSearchTerm] = useState("");

	return (
		<SearchContext.Provider value={{ searchTerm, setSearchTerm }}>
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
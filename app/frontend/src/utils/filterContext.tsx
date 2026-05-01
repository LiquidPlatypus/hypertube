import * as React from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type SortMode =
	| "relevance"
	| "rating_desc"
	| "rating_asc"
	| "year_desc"
	| "year_asc"
	| "title_asc"

export interface FiltersState {
	genreId: number | null;
	minRating: number | null;
	yearFrom: number | null;
	yearTo: number | null;
	sort: SortMode;
}

interface FilterContextType {
	filters: FiltersState;
	setFilters: React.Dispatch<React.SetStateAction<FiltersState>>;
	resetFilters: () => void;
}

const defaultFilters: FiltersState = {
	genreId: null,
	minRating: null,
	yearFrom: null,
	yearTo: null,
	sort: "relevance",
};

const FilterContext = createContext<FilterContextType | null>(null);

export function FilterProvider({ children }: { children: React.ReactNode }) {
	const [filters, setFilters] = useState<FiltersState>(defaultFilters);

	const value = useMemo<FilterContextType>(() => {
		return {
			filters,
			setFilters,
			resetFilters: () => setFilters(defaultFilters),
		};
	}, [filters]);

	return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilters() {
	const ctx = useContext(FilterContext);
	if (!ctx) throw new Error("useFilters() must be used inside FilterProvider");
	return ctx;
}
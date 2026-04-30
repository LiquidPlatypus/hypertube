import { useEffect, useMemo, useState } from "react";
import { useFilters, type SortMode } from "../../utils/filterContext.tsx";
import styles from "./FiltersBar.module.css";
import { getCurrentLang } from "../../lang/i18n.tsx";
import { t } from "../../lang/i18n.tsx";

type Genre = { id: number; name: string };

function toTmdbLanguage(lang: "en" | "fr") {
	return lang === "fr" ? "fr-FR" : "en-US";
}

export default function FiltersBar() {
	const { filters, setFilters, resetFilters } = useFilters();
	const [genres, setGenres] = useState<Genre[]>([]);
	const [loadingGenres, setLoadingGenres] = useState(false);
	const [lang, setLang] = useState(getCurrentLang);

	useEffect(() => {
		let cancelled = false;

		const fetchGenres = async () => {
			setLoadingGenres(true);
			try {
				const tmdbLanguage = toTmdbLanguage(getCurrentLang());
				const res = await fetch(`/api/genres?language=${encodeURIComponent(tmdbLanguage)}`);
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = (await res.json()) as Genre[];
				if (!cancelled) setGenres(data);
			} catch (e) {
				if (!cancelled) setGenres([]);
				console.error("Failed to load genres", e);
			} finally {
				if (!cancelled) setLoadingGenres(false);
			}
		};

		fetchGenres();

		const onLanguageChanged = () => {
			fetchGenres();
		};

		document.addEventListener("languageChanged", onLanguageChanged);

		return () => {
			cancelled = true;
			document.removeEventListener("languageChanged", onLanguageChanged);
		};
	}, []);

	useEffect(() => {
		const handler = () => setLang(getCurrentLang());
		document.addEventListener("languageChanged", handler);
		return () => document.removeEventListener("languageChanged", handler);
	}, []);

	const sortOptions = useMemo<{ value: SortMode; label: string }[]>(
		() => [
			{ value: "relevance", label: t("filters.sort.relevance") },
			{ value: "rating_desc", label: t("filters.sort.score.desc") },
			{ value: "rating_asc", label: t("filters.sort.score.asc") },
			{ value: "year_desc", label: t("filters.sort.year.desc") },
			{ value: "year_asc", label: t("filters.sort.year.asc") },
			{ value: "title_asc", label: t("filters.sort.title") },
		],
		[lang]
	);

	return (
		<div className={styles.bar}>
			<div className={styles.row}>
				<label className={styles.field}>
					<span className={styles.label}>{t("filters.genre")}</span>
					<select
						value={filters.genreId ?? ""}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								genreId: e.target.value ? Number(e.target.value) : null,
							}))
						}
					>
						<option value="">{loadingGenres ? t("loading") : t("filters.all")}</option>
						{genres.map((g) => (
							<option key={g.id} value={g.id}>
								{g.name}
							</option>
						))}
					</select>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>{t("filters.minRating")}</span>
					<input
						type="number"
						min={0}
						max={100}
						step={1}
						inputMode="numeric"
						placeholder="ex: 75"
						value={filters.minRating ?? ""}
						onChange={(e) => {
							const raw = e.currentTarget.value;

							const normalized = raw.replace(",", ".");

							if (normalized.trim() === "") {
								setFilters((prev) => ({ ...prev, minRating: null }));
								return;
							}

							const n = Number(normalized);

							if (Number.isNaN(n)) return;

							const clamped = Math.max(0, Math.min(100, n));

							setFilters((prev) => ({ ...prev, minRating: clamped }));
						}}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>{t("filters.year.from")}</span>
					<input
						type="number"
						min={1900}
						max={2100}
						placeholder="ex: 1990"
						value={filters.yearFrom ?? ""}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								yearFrom: e.target.value === "" ? null : Number(e.target.value),
							}))
						}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>{t("filters.year.to")}</span>
					<input
						type="number"
						min={1900}
						max={2100}
						placeholder="ex: 2024"
						value={filters.yearTo ?? ""}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								yearTo: e.target.value === "" ? null : Number(e.target.value),
							}))
						}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>{t("filters.sort")}</span>
					<select
						value={filters.sort}
						onChange={(e) =>
							setFilters((prev) => ({
								...prev,
								sort: e.target.value as SortMode,
							}))
						}
					>
						{sortOptions.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</label>

				<button className={styles.reset} onClick={resetFilters} type="button">
					{t("filters.reset")}
				</button>
			</div>
		</div>
	);
}
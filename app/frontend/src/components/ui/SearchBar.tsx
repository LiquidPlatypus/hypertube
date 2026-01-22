import * as React from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "../../hooks/useTranslation.tsx";
import SearchThumbnail from "./SearchThumbnail.tsx";
import styles from "./SearchBar.module.css";



interface SearchBarProps {
  closeSearch: () => void;
  currentLang: string;
}

type ApiMovie = {
  id: number;
  title: string;
  poster_path: string;
  release_date: string;
  score: number; // 0..10
};

type UiMovie = {
  id: number;
  title: string;
  year: number;
  rating: number; // 0..100
  thumbnailSrc: string;
};

const GENRES = [
  { id: "", labelKey: "search.allGenres" },
  { id: "28", labelKey: "search.action" },
  { id: "12", labelKey: "search.adventure" },
  { id: "35", labelKey: "search.comedy" },
  { id: "18", labelKey: "search.drama" },
  { id: "27", labelKey: "search.horror" },
  { id: "53", labelKey: "search.thriller" },
  { id: "10749", labelKey: "search.romance" },
  { id: "878", labelKey: "search.scifi" },
  { id: "14", labelKey: "search.fantasy" },
  { id: "16", labelKey: "search.animation" },
  { id: "99", labelKey: "search.documentary" },
];

function toYear(dateStr: string) {
  const y = Number(dateStr?.slice(0, 4));
  return Number.isFinite(y) ? y : 0;
}

function scoreToPercent(score10: number) {
  return Math.round((score10 ?? 0) * 10);
}

export default function SearchBar({ closeSearch }: SearchBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchValue, setSearchValue] = useState("");
  const [apiResults, setApiResults] = useState<UiMovie[]>([]);

  const [ratingFilter, setRatingFilter] = useState(0);
  const [yearFilter, setYearFilter] = useState<number | "">("");
  const [genreFilter, setGenreFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest("[data-keep-search-open]")) return;

      if (containerRef.current && !containerRef.current.contains(target)) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeSearch]);



  useEffect(() => {
    const controller = new AbortController();
    const q = searchValue.trim();

    const tmr = setTimeout(async () => {
      setLoading(true);
      try {
        let url = "";

        const shouldUseDiscover =
          yearFilter !== "" || genreFilter !== "" || ratingFilter > 0;

        if (shouldUseDiscover) {
          const params = new URLSearchParams();
          if (yearFilter !== "") params.set("year", String(yearFilter));
          if (genreFilter) params.set("genre", genreFilter);
          if (ratingFilter > 0) params.set("min_score", String(ratingFilter / 10));
          params.set("page", "1");

          url = `/api/discover?${params.toString()}`;
        } else {
          const params = new URLSearchParams();
          if (q.length > 0) params.set("query", q);
          params.set("page", "1");
          url = `/api/thumbnails?${params.toString()}`;
        }

        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = (await res.json()) as ApiMovie[];
        const mapped: UiMovie[] = (Array.isArray(data) ? data : []).map((m) => ({
          id: m.id,
          title: m.title,
          year: toYear(m.release_date),
          rating: scoreToPercent(m.score),
          thumbnailSrc: m.poster_path,
        }));

        setApiResults(mapped);
      } catch (e) {
        if ((e as any).name !== "AbortError") console.error(e);
        setApiResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(tmr);
    };
  }, [searchValue, yearFilter, ratingFilter, genreFilter]);

  const results = useMemo(() => {
    return apiResults;
  }, [apiResults]);

  const resetFilters = () => {
    setSearchValue("");
    setRatingFilter(0);
    setYearFilter("");
    setGenreFilter("");
    setApiResults([]);
  };

  const goToMovie = (movie: UiMovie) => {
    navigate(`/movie/${movie.id}`);
    closeSearch?.();
  };

  return (
    <div ref={containerRef} className={styles.SearchBarContainer}>
      <div className={styles.SearchRow}>
        <input
          type="text"
          className={styles.SearchBar}
          placeholder="Search..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
        <button className={styles.ResetBtn} onClick={resetFilters}>🔄</button>
      </div>

      <div className={styles.FiltersContainer}>
        <select value={ratingFilter} onChange={(e) => setRatingFilter(parseInt(e.target.value, 10))}>
          <option value={0}>{t("search.allRatings")}</option>
          <option value={50}>≥ 50%</option>
          <option value={60}>≥ 60%</option>
          <option value={70}>≥ 70%</option>
          <option value={80}>≥ 80%</option>
          <option value={90}>≥ 90%</option>
        </select>

        <input
          type="number"
          min={1888}
          max={2100}
          placeholder={t("search.allYears") ?? "Year"}
          value={yearFilter}
          onChange={(e) => {
            const v = e.target.value;
            setYearFilter(v === "" ? "" : Number(v));
          }}
          style={{ width: 120 }}
        />

        <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
          {GENRES.map((g) => (
            <option key={g.id || "all"} value={g.id}>
              {t(g.labelKey)}
            </option>
          ))}
        </select>
      </div>

      {loading && <div>Loading...</div>}

      {results.length > 0 && (
        <div className={styles.ThumbnailsContainer}>
          {results.reduce<React.ReactNode[][]>((rows, movie, index) => {
            if (index % 2 === 0) rows.push([]);
            rows[rows.length - 1].push(
              <SearchThumbnail
                key={movie.id}
                thumbnailSrc={movie.thumbnailSrc}
                title={movie.title}
                year={movie.year}
                rating={movie.rating}
                onClick={() => goToMovie(movie)}
              />
            );
            return rows;
          }, []).map((row, rowIndex) => (
            <div key={rowIndex} className={styles.ThumbnailsRow}>
              {row}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

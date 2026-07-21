// Session-only "watched" tracking for thumbnail badges.
//
// The badge must NOT persist beyond the current browser session: sessionStorage
// is cleared automatically when the browser/tab closes, and clearWatched() is
// called on logout/login. This is deliberately separate from the server-side
// watch_count/last_watched (which drive the 30-day cleanup retention).

const KEY = "watched_movies";

function read(): Set<number> {
	try {
		return new Set(JSON.parse(sessionStorage.getItem(KEY) || "[]"));
	} catch {
		return new Set();
	}
}

export function markWatched(id: number): void {
	const s = read();
	s.add(id);
	sessionStorage.setItem(KEY, JSON.stringify([...s]));
}

export function isWatched(id: number): boolean {
	return read().has(id);
}

export function clearWatched(): void {
	sessionStorage.removeItem(KEY);
}

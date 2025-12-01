export type Lang = "en" | "fr";
let currentLang: Lang = "en";
let translations: Record<string, string> = {};

export async function loadLanguage(lang: Lang) {
	const previousLang = currentLang;

	const res = await fetch(`/lang/${lang}.json`);
	translations = await res.json();
	currentLang = lang;

	document.documentElement.lang = lang;

	localStorage.setItem("lang", lang);

	// Déclenche un event pour notifier du changement de langue.
	document.dispatchEvent(new CustomEvent("languageChanged", {
		detail: {lang, previousLang}
	}));
}

export function t(key: string, vars?: Record<string, string | number | null>): string {
	let text = translations[key] || key;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			text = text.replace(`{{${k}}}`, String(v));
		}
	}

	return text;
}

export function getCurrentLang(): Lang {
	return currentLang;
}

/**
 * @brief Initialise la langue depuis le localStorage.
 */
export function initLanguage(): Lang {
	const savedLang = localStorage.getItem("lang") as Lang;
	if (savedLang && ["en", "fr"].includes(savedLang)) {
		currentLang = savedLang;
		document.documentElement.lang = savedLang;
	}
	return currentLang;
}

/**
 * @brief Expose la fonction t globalement.
 */
if (typeof window !== "undefined") {
	(window as any).t = t;
}
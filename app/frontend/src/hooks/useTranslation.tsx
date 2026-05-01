import { useState, useEffect } from "react";
import { t, getCurrentLang, loadLanguage, type Lang } from "../lang/i18n.tsx";

export function useTranslation() {
	const [, forceUpdate] = useState(0);

	useEffect(() => {
		const handleLanguageChange = () => {
			forceUpdate(prev => prev + 1);
		};

		document.addEventListener("languageChanged", handleLanguageChange as EventListener);
		return () => {
			document.removeEventListener("languageChanged", handleLanguageChange as EventListener);
		};
	}, []);

	return {
		t,
		currentLang: getCurrentLang(),
		changeLang: (lang: Lang) => loadLanguage(lang),
	}
}
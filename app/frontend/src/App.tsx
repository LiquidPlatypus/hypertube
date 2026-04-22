import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import MainLayout from "./layout/MainLayout.tsx";
import LoginLayout from "./layout/LoginLayout.tsx";
import {SearchProvider} from "./utils/searchContext.tsx";

import { initLanguage, loadLanguage } from "./lang/i18n.tsx";
import {FilterProvider} from "./utils/filterContext.tsx";

function App() {
	const { pathname } = useLocation();
	const isAuthRoute = pathname.startsWith("/auth");
	const [isI18nReady, setIsI18nReady] = useState(false);

	const Layout = isAuthRoute? LoginLayout : MainLayout;

	useEffect(() => {
		const initI18n = async () => {
			const savedLang = initLanguage();
			await loadLanguage(savedLang);
			setIsI18nReady(true);
		};

		initI18n();
	}, []);

	if (!isI18nReady) {
		return <div>Loading...</div>;
	}

	return (
		<SearchProvider>
			<FilterProvider>
				<Layout>
					<Outlet />
				</Layout>
			</FilterProvider>
		</SearchProvider>
	);
}

export default App;
import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";

import MainLayout from "./layout/MainLayout.tsx";
import LoginLayout from "./layout/LoginLayout.tsx";
import { initLanguage, loadLanguage } from "./lang/i18n.tsx";
import { GoogleOAuthProvider } from "@react-oauth/google";
import {SearchProvider} from "./utils/searchContext.tsx";

function App() {
	const { pathname } = useLocation();
	const isAuthRoute = pathname.startsWith("/auth");
	const [isI18nReady, setIsI18nReady] = useState(false);

	const Layout = isAuthRoute ? LoginLayout : MainLayout;

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
		<GoogleOAuthProvider clientId="504765868462-ssreveurjgq1i8tuoinem6fcp0g8kv90.apps.googleusercontent.com">
			<SearchProvider>
				<Layout>
					<Outlet />
				</Layout>
			</SearchProvider>
		</GoogleOAuthProvider>
	);
}

export default App;

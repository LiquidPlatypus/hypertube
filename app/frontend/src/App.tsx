import { Outlet, useLocation } from "react-router-dom";
import MainLayout from "./layout/MainLayout.tsx";
import LoginLayout from "./layout/LoginLayout.tsx";

function App() {
	const { pathname } = useLocation();
	const isAuthRoute = pathname.startsWith("/auth");

	const Layout = isAuthRoute? LoginLayout : MainLayout;

	return (
		<Layout>
			<Outlet />
		</Layout>
	);
}

export default App;
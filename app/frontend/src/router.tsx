import type { RouteObject } from "react-router-dom";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import EntryPage, { LoginPage } from "./pages/LoginPage.tsx";

const routes: RouteObject[] = [
	{
		path: "/",
		element: <App />,
		children: [
			{
				path: "/entry",
				element: <EntryPage />,
				children: [{ path: "/entry/login", element: <LoginPage /> }],
			},
		],
	},
];

export const router = createBrowserRouter(routes);

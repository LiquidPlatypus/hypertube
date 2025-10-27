import type { RouteObject } from "react-router-dom";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import LoginPage from "./pages/LoginPage.tsx";
import ProtectedRoute from "./components/ProtectedRoute.tsx";
import HomePage from "./pages/HomePage";

const routes: RouteObject[] = [
	{
		path: "/",
		element: <App />,
		children: [
			{
				// all protected element by login system must be here
				path: "/",
				element: <ProtectedRoute />,
				children: [
					{ path: "/", element: <HomePage /> },
				],
			},
			{
				path: "auth",
				children: [
					{
						path: "login",
						element:  (
							<LoginPage />
						),
					},
				],
			},
		],
	},
];

export const router = createBrowserRouter(routes);

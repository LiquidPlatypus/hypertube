import type { RouteObject } from "react-router-dom";
import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./component/ProtectedRoute";
import EntryPage from "./pages/EntryPage";
import HomePage from "./pages/HomePage";
import IdentifyForReset from "./component/IdentifyForReset";
import ForgotPassword from "./pages/ForgotPassword";

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
					{ path: "/forgot-password", element: <ForgotPassword /> }
				],
			},
			{
				path: "auth",
				children: [
					{
						path: "login",
						element:  (
							<EntryPage />
						),
					},
				],
			},
			{
				path: `reset/:token`,
				element: (
					<IdentifyForReset />
				),
			}
		],
	},
];

export const router = createBrowserRouter(routes);

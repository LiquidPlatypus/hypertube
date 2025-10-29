import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./utils/ProtectedRoute.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";

export const router = createBrowserRouter([
	{
		path: "/",
		element: <App />, // layout général
		children: [
			// Routes protégées
			{
				element: <ProtectedRoute />,
				children: [
					{
						path: "/",
						element: (

							<HomePage />

						),
					},
				],
			},
			// Auth routes
			{
				path: "auth/login",
				element: <LoginPage />,
			},
			{
				path: "auth/register",
				element: <LoginPage />,
			},
		],
	},
]);
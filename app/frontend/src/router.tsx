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
				// Route d'acceuil - pour les user connecte
				index: true, // indique que c'est la route par default a "/"
				element: (
					<ProtectedRoute requireAuth={true}>
						<HomePage />
					</ProtectedRoute>
				),
			},
			{
				// Groupe des routes d'auth
				// pour les user NON connecte
				path: "auth",
				children: [
					{
						// Route /auth/login pour la connexion
						path: "login",
						element:  (
							<ProtectedRoute requireAuth={false}>
								<LoginPage />
							</ProtectedRoute>
						),
					},
					// route "forget-password"
					// route "reset-password"
				],
			},
		],
	},
];

export const router = createBrowserRouter(routes);

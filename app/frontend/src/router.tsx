import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./utils/ProtectedRoute.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProfilInfo from "./pages/ProfilePage.tsx";
import WIPVideo from "./pages/WIPVideo.tsx";
import FortyTwoPopupCallback from "./pages/FortyTwoPopupCallback.tsx";


export const router = createBrowserRouter([
	{
		path: "/",
		element: <App />,
		children: [
			// Routes protégées
			{
				element: <ProtectedRoute />,
				children: [
					{ path: "/", element: <HomePage /> },
					{ path: "/profile", element: <ProfilInfo /> },
					{ path: "/movie/:id", element: <WIPVideo /> },
				],
			},

			// Auth routes
			{ path: "auth/login", element: <LoginPage /> },
			{ path: "auth/register", element: <LoginPage /> },

			// ✅ Callback 42
			{ path: "auth/42/popup-callback", element: <FortyTwoPopupCallback />,
				},

		],
	},
]);

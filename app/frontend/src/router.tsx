import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./utils/ProtectedRoute.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProfilInfo from "./pages/ProfilePage.tsx";
import VideoPage from "./pages/VideoPage.tsx";
import PublicProfile from "./pages/PublicProfile.tsx";
import FgPassword from "./pages/FgPasswordPage.tsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.tsx";

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
					{
						path: "/profile",
						element: (
							<ProfilInfo />
						),
					},
					{
						path: "/movie/:id",
						element: (
							<VideoPage />
						),
					},
					{
						path: "/users/:id",
						element: (
							<PublicProfile />
						),
					},
				],
			},
			// Auth routes
			{
				path: "auth/login",
				element: <LoginPage />,
				children: [

				]
			},
			{
				path: "auth/register",
				element: <LoginPage />,
			},
			// Password reset routes
			{
				path: "/auth/login/forgot-password",
				element: (
					<FgPassword />
				),
			},
			{
				path:"reset-password/:token",
				element: (
					<ResetPasswordPage />
				)
			},
		],
	},
]);
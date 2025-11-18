// import { createBrowserRouter } from "react-router-dom";
// import App from "./App";
// import ProtectedRoute from "./utils/ProtectedRoute.tsx";
// import HomePage from "./pages/HomePage.tsx";
// import LoginPage from "./pages/LoginPage.tsx";


// export const router = createBrowserRouter([
// 	{
// 		path: "/",
// 		element: <App />, // layout général
// 		children: [
// 			// Routes protégées
// 			{
// 				element: <ProtectedRoute />,
// 				children: [
// 					{
// 						path: "/",
// 						element: (
// 							<HomePage />
// 						),
// 					},
// 				],
// 			},
// 			// Auth routes
// 			{
// 				path: "auth/login",
// 				element: <LoginPage />,
// 			},
// 			{
// 				path: "auth/register",
// 				element: <LoginPage />,
// 			},
// 		],
// 	},
// ]);

import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import ProtectedRoute from "./utils/ProtectedRoute.tsx";
import HomePage from "./pages/HomePage.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import ProfilInfo from "./pages/ProfilePage.tsx"; // <-- importe la page profil

export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, 
    children: [
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: "/",
            element: <HomePage />,
          },
          {
            path: "/profile",
            element: <ProfilInfo />,  // <-- route profil ajoutée
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

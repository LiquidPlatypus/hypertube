# Hypertube
Hypertube project for 42 School


## Init new front :

In your front component, you need ProtectedRoute.tsx:

```ts
export default function ProtectedRoute() {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const verifyToken = async () => {
			const token = localStorage.getItem('access_token');
			console.log(token);

			try {
				const response = await fetch(`/api/verify-token/${token}`);
				if (!response.ok) {
					throw new Error("Invalid token");
				}
				const data = await response.json();
				console.log(data.message);
			} catch (error) {
				console.log("Remove or invalid access_token");
				localStorage.removeItem('access_token');
				navigate('/auth/login');
			} finally {
				setLoading(false);
			}
		};
		verifyToken();
	}, [navigate]);

	if (loading)
		return <div><h1>Loading</h1></div>
	return <div><Outlet /></div>
}
```

### and router.tsx:

```ts
import type { RouteObject } from "react-router-dom";
import { createBrowserRouter } from "react-router-dom";
// Import all component here, example:
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
				// all element protected by login system must be in children of ProtectedRoute
				path: "/",
				element: <ProtectedRoute />,
				children: [
                    // Example :
                    // { path: "(URL)", element: <(Component link to the path) />},
					{ path: "/", element: <HomePage /> },
				],
			},
			{
                // here is public element, like login page or register:
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
```

### and the last step in main.tsx:

```ts
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import * as React from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<RouterProvider router={router} /> // All client goes through here before anything else
	</React.StrictMode>,
);
```

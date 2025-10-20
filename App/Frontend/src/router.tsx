import type { RouteObject } from "react-router-dom";
import { createBrowserRouter } from "react-router-dom";
import App from "./App"
import Home from "./Home"
import Entry, { Login, Register } from "./Entry";

const routes: RouteObject[] = [
    {
        path: "/",
        element: <App />,
        children: [
            { path: "/", element: <Home /> },
            {
                path: "/entry",
                element: <Entry />,
                children: [
                    { path: "/entry/login", element: <Login /> },
                    { path: "/entry/register", element: <Register /> },
                ],
            },
        ],
    },
];

export const router = createBrowserRouter(routes);
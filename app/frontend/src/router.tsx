import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import RetroTvLoginWrapper from "./components/RetroTv";
import ProtectedRoute from "./components/ProtectedRoute";
import HomePage from "./components/HomePage";


const tvProps = {
  videoSrc: "/screen2.mp4",
  tvImageSrc: "/TV.png",
  tvWidth: 6144,
  tvHeight: 6144,
  screenX: 1200,
  screenY: 1750,
  screenWidth: 2832,
  screenHeight: 2593,
};

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
            element: (<HomePage />),
          },
         
        ],
      },
      // Auth routes
      {
        path: "auth/login",
        element: <RetroTvLoginWrapper {...tvProps} />,
      },
      {
        path: "auth/register",
        element: <RetroTvLoginWrapper {...tvProps} />,
      },
    ],
  },
]);

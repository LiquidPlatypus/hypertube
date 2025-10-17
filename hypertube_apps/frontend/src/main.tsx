import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider  } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import SysLog, { Login, Register } from './pages/syslog.jsx'

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/syslog",
        element: <SysLog />,
        children: [
          { path: "/syslog/login", element: <Login /> },
          { path: "/syslog/Register", element: <Register /> },
        ],
      },
    ],
  }
]);

createRoot(document.getElementById('root')).render(
  // <StrictMode>
  //   <App />
  // </StrictMode>,
  <RouterProvider router={router} />
)

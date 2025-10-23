import "./styles/App.css";

import Header from "./components/layout/Header.tsx";
import PageFrame from "./components/layout/PageFrame.tsx";
import Footer from "./components/layout/Footer.tsx";
import { Outlet, useNavigate } from "react-router-dom";
import Button from "./components/ui/Button.tsx";
import { JSX } from "react";

function App() {
	// useEffect(() => {
	//   const socket = new WebSocket("ws://127.0.0.1:8000/ws");

	//   socket.onopen = () => {
	//     console.log("Connected !");
	//   };
	//   socket.onmessage = (event) => console.log("Server:", event.data);
	//   return () => socket.close();
	// }, []);

	const navigate = useNavigate();

	const handleLogout = () => {
		// Supprime le token
		localStorage.removeItem("authToken");
		// Redirect vers login
		navigate("/auth/login");
	};

	// Verif si user est connecte
	const isAuthenticated = localStorage.getItem("authToken") !== null;

	return (
		<main>
			<Header />
			<PageFrame>
				{isAuthenticated ? <Button text="Logout" onClick={handleLogout} /> : null}
				<Outlet />
			</PageFrame>
			<Footer />
		</main>
	);
}

export default App;

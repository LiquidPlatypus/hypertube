import "./styles/App.css";

import Header from "./components/layout/Header.tsx";
import PageFrame from "./components/layout/PageFrame.tsx";
import Footer from "./components/layout/Footer.tsx";
import { Outlet, useNavigate } from "react-router-dom";
import Button from "./components/ui/Button.tsx";

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

	return (
		<main>
			<Header />
			<PageFrame>
				<Button text="Entry" onClick={() => navigate("/entry")} />
				<Outlet />
			</PageFrame>
			<Footer />
		</main>
	);
}

export default App;

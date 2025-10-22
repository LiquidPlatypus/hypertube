import "./styles/App.css";

import Header from "./components/layout/Header.tsx";
import PageFrame from "./components/layout/PageFrame.tsx";
import LoginPage from "./pages/LoginPage.tsx";
import Footer from "./components/layout/Footer.tsx";

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom';
import './App.css'

function App() {
  // useEffect(() => {
  //   const socket = new WebSocket("ws://127.0.0.1:8000/ws");

  //   socket.onopen = () => {
  //     console.log("Connected !");
  //   };
  //   socket.onmessage = (event) => console.log("Server:", event.data);
  //   return () => socket.close();
  // }, []);

	return (
		<main>
			<Header />
			<PageFrame>
				<LoginPage />
			</PageFrame>
			<Footer />
		</main>
	);
}

export default App;

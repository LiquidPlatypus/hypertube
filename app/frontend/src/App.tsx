import { useState } from 'react'
import { Outlet } from 'react-router-dom'
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
    <>
    <Outlet/>
    </>
  )
}

export default App

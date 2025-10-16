import { useEffect } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/ws");

    socket.onopen = () => {
      console.log("Connecté !");
      socket.send("Salut du front !");
    };
    socket.onmessage = (event) => console.log("Serveur:", event.data);
    return () => socket.close();
  }, []);

  return (
    <>
		<div style={{ textAlign: 'center', marginTop: '20%' }}>
			<h1>OK.Tube !</h1>
		</div>
    </>
  )
}

export default App

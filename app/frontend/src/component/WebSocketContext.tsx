import React, { createContext, useContext, useEffect, useRef } from "react";

type WebSocketContextType = {
	socket: WebSocket | null;
	sendMessage: (msg: string) => void;
};

const WebSocketContext = createContext<WebSocketContextType>({
	socket: null,
	sendMessage: () => { },
});

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
	const socketRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const ws = new WebSocket("ws://127.0.0.1:8000/ws");
		socketRef.current = ws;

		ws.onopen = () => console.log("WS Connected");
		ws.onmessage = (msg) => console.log("WS Message:", msg.data);
		ws.onerror = (err) => console.error("WS Error:", err);

		return () => ws.close();
	}, []);

	const sendMessage = (msg: string) => {
		if (socketRef.current?.readyState === WebSocket.OPEN) {
		socketRef.current.send(msg);
		} else {
		console.warn("Socket not ready");
		}
	};

	return (
		<WebSocketContext.Provider value={{ socket: socketRef.current, sendMessage }}>
		{children}
		</WebSocketContext.Provider>
	);
};

export const useWebSocket = () => useContext(WebSocketContext);

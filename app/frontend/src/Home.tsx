import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
	const navigate = useNavigate();
	const [message, setMessage] = useState("");

	const handleMessage = async (e: React.MouseEvent<HTMLButtonElement>) => {
		e.preventDefault();
		try {
			const token = localStorage.getItem("access_token");
			const response = await fetch("/api/hello", {
				method: "GET",
				headers: {
					Authorization: `Bearer ${token}`,
				},
			});

			if (!response.ok) {
				throw new Error("Not authorized");
			}
			const data = await response.json();
			setMessage(data.message);
		} catch (error) {
			setMessage("Error server message");
		}
	};

	return (
		<div>
			<button onClick={() => navigate("/entry/login")}>Connect</button>
			<button onClick={handleMessage}>Click me</button>
			<p>{message}</p>
		</div>
	);
}

import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";

export default function ProtectedRoute() {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const verifyToken = async () => {
			const token = localStorage.getItem('access_token');
			console.log(token);

			try {
				const response = await fetch(`/api/verify-token/${token}`);
				if (!response.ok) {
					throw new Error("Invalid token");
				}
				const data = await response.json();
				console.log(data.message);
			} catch (error) {
				console.log("Remove or invalid access_token");
				localStorage.removeItem('access_token');
				navigate('/auth/login');
			} finally {
				setLoading(false);
			}
		};
		verifyToken();
	}, [navigate]);

	if (loading)
		return <div><h1>Loading</h1></div>
	return <div><Outlet /></div>
}
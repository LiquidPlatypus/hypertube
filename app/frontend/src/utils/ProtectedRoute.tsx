import { useEffect, useState, type ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";

interface ProtectedRouteProps {
	children?: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
	const navigate = useNavigate();
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		const verifyToken = async () => {
			const token = localStorage.getItem('access_token');
			try {
				const response = await fetch(`/api/verify-token/${token}`);
				if (!response.ok) throw new Error("Invalid token");
				await response.json();
			} catch (error) {
				localStorage.removeItem('access_token');
				navigate('/auth/login');
			} finally {
				setLoading(false);
			}
		};
		verifyToken();
	}, [navigate]);

	if (loading) return <div><h1>Loading</h1></div>;

	return <>{children ?? <Outlet />}</>;
}
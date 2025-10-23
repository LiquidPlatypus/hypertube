import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
	children: ReactNode;
	requireAuth: boolean; // true = nécessite d'être connecté, false = nécessite d'être déconnecté}
}

// Simule la verification de la connexion
function isUserAuthenticated(): boolean {
	// TODO: a remplacer par une vraie verif du token
	const token = localStorage.getItem("authToken");
	return token !== null && token !== "";
}

export default function ProtectedRoute({ children, requireAuth }: ProtectedRouteProps) {
	const isAuthenticated = isUserAuthenticated();

	// Si route necessite d'etre co mais que l'user ne l'est pas
	if (requireAuth && !isAuthenticated) {
		// Redirect vers la page de login
		return <Navigate to="/auth/login" replace />;
	}

	// Si route necessite d'etre deco mais que l'user est co
	// ex: page de login pour un user co
	if (!requireAuth && isAuthenticated) {
		// redirect vers acceuil
		return <Navigate to="/" replace />;
	}

	// Si ok, affiche composant demande
	return <>{children}</>;
}
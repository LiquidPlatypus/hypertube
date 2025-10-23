import * as React from "react";
import { useNavigate } from "react-router-dom";
import Button from "./Button.tsx";
import { useRef } from "react";

import styles from "./Popup.module.css";

interface PopupProps {
	anchor: HTMLElement | null;
	onClose: () => void;
}

export default function Popup({ anchor, onClose }: PopupProps) {
	const navigate = useNavigate();

	const popupRef = useRef<HTMLDivElement | null>(null);
	const [position, setPosition] = React.useState<{ top: number; left: number }>({
		top: 0,
		left: 0,
	});

	// Recalcule la position si changement de taille de fenetre
	const updatePosition = React.useCallback(() => {
		if (!anchor || !popupRef.current) return;
		const rect = anchor.getBoundingClientRect();
		const popup = popupRef.current;
		const popupWidth = popup.offsetWidth;
		const popupHeight = popup.offsetHeight;

		let top = rect.bottom + window.scrollY + 8;
		let left = rect.left + window.scrollX;

		// Ajustement horizontal si le popup dépasse à droite
		if (left + popupWidth > window.innerWidth - 8) {
			left = window.innerWidth - popupWidth - 8;
		}

		// Ajustement vertical si le popup dépasse en bas
		if (top + popupHeight > window.innerHeight + window.scrollY - 8) {
			top = rect.top + window.scrollY - popupHeight - 8;
		}

		setPosition({ top, left });
	}, [anchor]);

	const popupStyle: React.CSSProperties = {
		position: "absolute",
		top: position.top,
		left: position.left,
		backgroundColor: "white",
		border: "1px solid #ccc",
		borderRadius: "8px",
		padding: "0.5rem",
		boxShadow: "0 2px 10px rgba(0, 0, 0, 0.2)",
		zIndex: 1000,
		minWidth: "160px",
	};

	// Init + ecoute des resize/scroll
	React.useEffect(() => {
		updatePosition();
		window.addEventListener("resize", updatePosition);
		window.addEventListener("scroll", updatePosition);

		return () => {
			window.removeEventListener("resize", updatePosition);
			window.removeEventListener("scroll", updatePosition);
		};
	}, [updatePosition]);

	// Ferme si clic dehors
	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				!anchor.contains(event.target as Node) &&
				!popupRef.current?.contains(event.target as Node)
			) {
				onClose();
			}
		};
		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, [anchor, onClose]);

	const handleLogout = () => {
		// Supprime le token
		localStorage.removeItem("authToken");
		// Redirect vers login
		navigate("/auth/login");
	};

	return (
		<div ref={popupRef} style={popupStyle}>
			<Button text="See profile" onClick={() => console.log("See profile")} />
			<Button text="Logout" onClick={() => handleLogout()} />
		</div>
	)
}
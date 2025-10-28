import React from "react";
import Button from "./Button.tsx";

type ImageButtonProps = {
	/** Image affichee dans le bouton */
	icon: string;
	/** Texte alternatif pour l'accessibilite */
	alt?: string;
	/** Taille du bouton */
	size?: "small" | "medium" | "large";
	/** Forme du bouton */
	shape?: "rounded" | "square" | "pill";
	/** Styles supplementaires */
	style?: React.CSSProperties;
	/** Classes CSS supplementaires */
	className?: string;
	/** Action au clic */
	onClick?: () => void;
};

export default function ImageButton({
	icon,
	alt = "",
	size = "medium",
	shape = "rounded",
	style,
	className = "",
	onClick,
}: ImageButtonProps) {
	return (
		<Button
			icon={icon}
			alt={alt}
			size={size}
			shape={shape}
			style={style}
			className={className}
			onClick={onClick}
			imageOnly
		/>
	);
}

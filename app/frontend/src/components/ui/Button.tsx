import * as React from "react";
import styles from "./Button.module.css";

type ButtonProps = {
	text?: string;
	size?: "small" | "medium" | "large";
	shape?: "rounded" | "square" | "pill";
	icon?: string;
	imageOnly?: boolean;
	style?: React.CSSProperties;
	className?: string;
	onClick?: (e: React.MouseEvent<HTMLElement>) => void;
	alt?: string;
};

export default function Button({
	text = "Button",
	size = "medium",
	shape = "rounded",
	icon,
	imageOnly = false,
	style,
	className = "",
	onClick,
	alt = "",
}: ButtonProps) {
	const classNames = [
		styles.button,
		styles[size],
		shape ? styles[shape] : "",
		imageOnly ? styles.imageOnly : "",
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			onClick={onClick}
			className={classNames}
			style={!imageOnly ? style : undefined} // ✅ style appliqué sur le bouton seulement si ce n’est pas une image-only
		>
			{icon && (
				<img
					src={icon}
					alt={alt}
					className={styles.icon}
					style={imageOnly ? style : undefined} // ✅ style appliqué sur l’image si imageOnly
				/>
			)}
			{!imageOnly && text}
		</button>
	);
}

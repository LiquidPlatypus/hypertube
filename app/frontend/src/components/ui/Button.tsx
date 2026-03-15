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
	variant?: "default" | "dark" | "remote" | "profileEdit"
	onClick?: () => void;
	alt?: string;
};

export default function Button({
	text,
	size = "medium",
	shape = "rounded",
	icon,
	imageOnly = false,
	style,
	className = "",
	variant = "default",
	onClick,
	alt = "",
}: ButtonProps) {
	const classNames = [
		styles.button,
		styles[size],
		styles[shape],
		styles[variant || "default"],
		!imageOnly && styles.colored,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			onClick={onClick}
			className={classNames}
			style={!imageOnly ? style : undefined}
		>
			{icon && (
				<img
					src={icon}
					alt={alt}
					className={imageOnly ? styles.iconOnly : styles.icon}
					style={imageOnly ? style : undefined}
				/>
			)}
			{!imageOnly && text}
		</button>
	);
}

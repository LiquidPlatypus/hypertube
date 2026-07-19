import * as React from "react";
import styles from "./Button.module.css";

type ButtonProps = {
	text?: string;
	size?: "small" | "medium" | "large";
	shape?: "rounded" | "square" | "pill";
	type?: "submit" | "reset" | "button";
	icon?: string;
	imageOnly?: boolean;
	style?: React.CSSProperties;
	className?: string;
	variant?: "default" | "dark" | "remote" | "profileEdit"
	onClick?: () => void;
	alt?: string;
	disabled?: boolean;
};

export default function Button({
	text,
	size = "medium",
	shape = "rounded",
	type = "button",
	icon,
	imageOnly = false,
	style,
	className = "",
	variant = "default",
	onClick,
	alt = "",
	disabled = false,
    }: ButtonProps) {
	const classNames = [
		styles.button,
		styles[size],
		styles[shape],
		styles[variant || "default"],
		!imageOnly && styles.colored,
		disabled && styles.disabled,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			onClick={onClick}
			className={classNames}
			style={!imageOnly ? style : undefined}
			type={type}
			disabled={disabled}
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
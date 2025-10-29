import * as React from "react";

type ButtonProps = {
	text?: string;
	size?: "small" | "medium" | "large";
	shape?: "rounded" | "square" | "pill";
	icon?: string;
	imageOnly?: boolean;
	style?: React.CSSProperties;
	className?: string;
	onClick?: () => void;
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
	// Tailwind classes dynamiques
	const sizeClasses = {
		small: "px-3 py-1 text-sm",
		medium: "px-4 py-2 text-base",
		large: "px-6 py-3 text-lg",
	};

	const shapeClasses = {
		rounded: "rounded-md",
		square: "rounded-none",
		pill: "rounded-full",
	};

	const baseClasses =
		"font-bold transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none";

	const colorClasses = imageOnly
		? ""
		: "bg-yellow-400 text-black hover:bg-yellow-500";

	const finalClasses = [
		baseClasses,
		sizeClasses[size],
		shapeClasses[shape],
		colorClasses,
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button onClick={onClick} className={finalClasses} style={!imageOnly ? style : undefined}>
			{icon && (
				<img
					src={icon}
					alt={alt}
					className={imageOnly ? "w-full h-full" : "inline-block mr-2 w-5 h-5"}
					style={imageOnly ? style : undefined}
				/>
			)}
			{!imageOnly && text}
		</button>
	);
}
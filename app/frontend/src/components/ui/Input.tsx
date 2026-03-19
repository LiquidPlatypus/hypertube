import * as React from "react";
import styles from "./Input.module.css";

type InputProps = {
	type?: string;
	placeholder?: string;
	accept?: string;
	value?: string;
	variant?: "default" | "profileEdit" | "comment";
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	size?: "small" | "medium" | "large";
	shape?: "rounded" | "square" | "pill";
	iconLeft?: string;
	iconRight?: string;
	className?: string;
	style?: React.CSSProperties;
	required?: boolean;

	id?: string;
	name?: string;
	autoComplete?: string;
};

export default function Input({
	type = "text",
	placeholder = "",
	accept,
	value = "",
	variant = "default",
	onChange,
	size = "medium",
	shape = "rounded",
	iconLeft,
	iconRight,
	className = "",
	style,
	required = false,

	name,
	autoComplete,
}: InputProps) {
	const classNames = [
		styles.input,
		styles[size],
		styles[shape],
		styles[variant || "default"],
		className,
	].filter(Boolean).join(" ");

	return (
		<div className={styles.wrapper}>
			{iconLeft && (
				<img src={iconLeft} alt="" className={`${styles.icon} ${styles.left}`} />
			)}
			<input
				type={type}
				placeholder={placeholder}
				value={value}
				accept={accept}
				onChange={onChange}
				className={classNames}
				style={style}
				required={required}

				name={name}
				autoComplete={autoComplete}
			/>
			{iconRight && (
				<img src={iconRight} alt="" className={`${styles.icon} ${styles.right}`} />
			)}
		</div>
	);
}

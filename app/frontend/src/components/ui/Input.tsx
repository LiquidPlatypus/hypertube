import * as React from "react";
import styles from "./Input.module.css";

type InputProps = {
	type?: string;
	placeholder?: string;
	accept?: string;
	value?: string;
	onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
	size?: "small" | "medium" | "large";
	shape?: "rounded" | "square" | "pill";
	iconLeft?: string;
	iconRight?: string;
	className?: string;
	style?: React.CSSProperties;
	required?: boolean;
};

export default function Input({
	type = "text",
	placeholder = "",
	accept,
	value = "",
	onChange,
	size = "medium",
	shape = "rounded",
	iconLeft,
	iconRight,
	className = "",
	style,
	required = false,
}: InputProps) {
	const classNames = [
		styles.input,
		styles[size],
		styles[shape],
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
			/>
			{iconRight && (
				<img src={iconRight} alt="" className={`${styles.icon} ${styles.right}`} />
			)}
		</div>
	);
}

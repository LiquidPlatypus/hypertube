import * as React from "react";
import styles from "./Textarea.module.css";

type TextareaProps = {
	placeholder?: string;
	cols?: number;
	rows?: number;
	maxLength?: number;
	wrap?: "hard" | "soft" | "off";
	value: string;
	onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
	className?: string;
	style?: React.CSSProperties;
	required?: boolean;
	size?: "small" | "medium" | "large";
	shape?: "rounded" | "square" | "pill";
	variant?: "default" | "comment";
	autoGrow?: boolean;
	maxAutoGrowHeightPx?: number;
}

export default function Textarea({
	placeholder = "",
	cols,
	rows = 1,
	maxLength,
	wrap,
	value,
	onChange,
	onKeyDown,
	className = "",
	style,
	required = false,
	size = "medium",
	shape = "rounded",
	variant = "default",
	autoGrow = true,
	maxAutoGrowHeightPx,
}: TextareaProps) {
	const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

	const resize = React.useCallback(() => {
		if (!autoGrow) return;
		const el = textareaRef.current;
		if (!el) return;

		// Reset height so it can shrink when deleting content.
		el.style.height = "auto";
		const nextHeight = el.scrollHeight;

		if (maxAutoGrowHeightPx && nextHeight > maxAutoGrowHeightPx) {
			el.style.height = `${maxAutoGrowHeightPx}px`;
			el.style.overflowY = "auto";
		} else {
			el.style.height = `${nextHeight}px`;
			el.style.overflowY = "hidden";
		}
	}, [autoGrow, maxAutoGrowHeightPx]);

	// Keep height in sync with controlled value (including when it's reset to "").
	React.useLayoutEffect(() => {
		resize();
	}, [value, resize]);

	const classNames = [
		styles.textarea,
		styles[size],
		styles[shape],
		styles[variant],
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div className={styles.wrapper}>
			<textarea
				ref={textareaRef}
				placeholder={placeholder}
				cols={cols}
				rows={rows}
				maxLength={maxLength}
				wrap={wrap}
				value={value}
				onChange={(e) => {
					onChange(e);
				}}
				onKeyDown={onKeyDown}
				className={classNames}
				style={style}
				required={required}
			/>
		</div>
	);
}
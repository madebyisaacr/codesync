import { CodeFile } from "../types";
import { useState, useEffect, useRef } from "react";
import classNames from "classnames";

interface FileListItemProps {
	file: CodeFile;
	children?: React.ReactNode | React.ReactNode[];
}

export function FileListItem({ file, children }: FileListItemProps) {
	const [isOverflowing, setIsOverflowing] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const spanRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const checkOverflow = () => {
			if (spanRef.current) {
				setIsOverflowing(spanRef.current.scrollWidth > spanRef.current.offsetWidth);
			}
		};

		checkOverflow();
		window.addEventListener("resize", checkOverflow);
		return () => window.removeEventListener("resize", checkOverflow);
	}, [file.name]);

	return (
		<div className="flex-row justify-between items-center h-6 shrink-0 gap-2 pl-0.5">
			<CodeFileIcon />
			<div className="relative flex-1 min-w-0" ref={containerRef}>
				<span
					ref={spanRef}
					className={classNames(
						"whitespace-nowrap overflow-hidden block w-full text-secondary",
						isOverflowing ? "text-right" : "text-left"
					)}
					style={isOverflowing ? { direction: "rtl" } : undefined}
					title={file.name}
				>
					{file.name}
				</span>
				<div
					className={classNames("absolute inset-y-0 w-6", isOverflowing ? "left-0" : "right-0")}
					style={{
						opacity: isOverflowing ? 0.9 : 0,
						background: isOverflowing
							? "linear-gradient(to left, transparent, var(--framer-color-bg))"
							: "linear-gradient(to right, transparent, var(--framer-color-bg))",
					}}
				/>
			</div>
			{children}
		</div>
	);
}

function CodeFileIcon() {
	return (
		<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12">
			<path
				d="M 4 3 L 1 6 L 4 9"
				fill="transparent"
				strokeWidth="2"
				stroke="#999"
				strokeLinecap="round"
				strokeLinejoin="round"
			></path>
			<path
				d="M 8 3 L 11 6 L 8 9"
				fill="transparent"
				strokeWidth="2"
				stroke="#999"
				strokeLinecap="round"
				strokeLinejoin="round"
			></path>
		</svg>
	);
}

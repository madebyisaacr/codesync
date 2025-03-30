import { useState, useEffect, useRef } from "react";
import { BackButton } from "./PageStack";
import { framer } from "framer-plugin";

interface DirectoryPageProps {
	onSaveDirectory: (directory: string) => void;
	currentDirectory: string | null;
}

interface DirectoryEditorProps {
	onSaveDirectory: (directory: string) => void;
	currentDirectory: string | null;
}

export function DirectoryPage({ onSaveDirectory, currentDirectory }: DirectoryPageProps) {
	const onCopyClick = async () => {
		const success = await copyToClipboard(currentDirectory || "");
		if (success) {
			framer.notify("Copied directory path to clipboard", { variant: "success" });
		} else {
			framer.notify("Failed to copy directory path to clipboard", { variant: "error" });
		}
	};

	return (
		<div className="p-3 w-full overflow-y-auto flex-col gap-3">
			<BackButton />
			<div className="flex-col gap-2 w-full">
				<div className="w-full flex-col gap-1 mb-1">
					<span className="font-semibold">Change Directory</span>
					<p>The code files in this Framer project will be synced to this folder on your device.</p>
				</div>
				<DirectoryEditor onSaveDirectory={onSaveDirectory} currentDirectory={currentDirectory} />
			</div>
			{currentDirectory && (
				<>
					<div className="w-full h-px shrink-0 bg-divider" />
					<div className="flex-col gap-1">
						<span className="font-semibold">Current Directory</span>
						<p className="break-words whitespace-normal flex-col" title={currentDirectory}>
							{currentDirectory.replace(/^\/+|\/+$/g, "").replace(/\//g, " → ")}
						</p>
						<button onClick={onCopyClick} className="w-fit px-2 bg-secondary mt-1">
							Copy
						</button>
					</div>
				</>
			)}
		</div>
	);
}

export function DirectoryEditor({ onSaveDirectory, currentDirectory }: DirectoryEditorProps) {
	const [directoryInput, setDirectoryInput] = useState(currentDirectory || "");
	const directoryInputRef = useRef<HTMLInputElement>(null);

	const onDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDirectoryInput(e.target.value);
	};

	useAutoFocus(directoryInputRef);

	return (
		<div className="w-full flex-col gap-2">
			<input
				ref={directoryInputRef}
				type="text"
				value={directoryInput}
				onChange={onDirectoryChange}
				placeholder="Enter directory path"
				className="w-full"
			/>
			<button
				className="w-full framer-button-primary"
				onClick={() => onSaveDirectory(directoryInput)}
			>
				Save Directory
			</button>
		</div>
	);
}

function useAutoFocus(inputRef: React.RefObject<HTMLInputElement>) {
	useEffect(() => {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting) {
					inputRef.current.focus();
				}
			},
			{ threshold: 1.0 } // Fully visible
		);

		if (inputRef.current) {
			observer.observe(inputRef.current);
		}

		return () => {
			if (inputRef.current) {
				observer.unobserve(inputRef.current);
			}
		};
	}, []);
}

async function copyToClipboard(text: string) {
	// Check if the Clipboard API is available
	try {
		if (navigator.clipboard && window.isSecureContext) {
			// Use the Clipboard API
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch (err) {
		console.error("Failed to write to clipboard using clipboard API:", err);
	}

	try {
		// Fallback for browsers that don't support Clipboard API
		let textArea = document.createElement("textarea");
		textArea.value = text;

		// Make the textarea out of viewport
		textArea.style.position = "fixed";
		textArea.style.left = "-999999px";
		textArea.style.top = "-999999px";
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();

		let successful = document.execCommand("copy");
		document.body.removeChild(textArea);

		return successful;
	} catch (err) {
		console.error("Failed to copy text: ", err);
		return false;
	}
}

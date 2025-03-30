import { useState, useEffect, useRef } from "react";
import { BackButton } from "./PageStack";

interface DirectoryPageProps {
	onSaveDirectory: (directory: string) => void;
	currentDirectory: string | null;
}

interface DirectoryEditorProps {
	onSaveDirectory: (directory: string) => void;
	currentDirectory: string | null;
}

export function DirectoryPage({ onSaveDirectory, currentDirectory }: DirectoryPageProps) {
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
						<p className="break-words whitespace-normal flex-col">{currentDirectory}</p>
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

export function useAutoFocus(inputRef: React.RefObject<HTMLInputElement>) {
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

import { BackButton } from "./PageStack";

interface DirectoryEditorProps {
	directoryInput: string;
	onDirectoryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	onSaveDirectory: () => void;
	currentDirectory: string | null;
}

export function DirectoryEditor({
	directoryInput,
	onDirectoryChange,
	onSaveDirectory,
	currentDirectory,
}: DirectoryEditorProps) {
	return (
		<div className="p-3 w-full overflow-y-auto flex-col gap-3">
			<BackButton />
			<div className="flex-col gap-2 w-full">
				<div className="w-full flex-col gap-1 mb-1">
					<span className="font-semibold">Change Directory</span>
					<p>The code files in this Framer project will be synced to this folder on your device.</p>
				</div>
				<input
					type="text"
					value={directoryInput}
					onChange={onDirectoryChange}
					placeholder="Enter directory path"
					className="w-full"
				/>
				<button className="w-full framer-button-primary" onClick={onSaveDirectory}>
					Save Directory
				</button>
			</div>
			{currentDirectory && (
				<>
					<div className="w-full h-px shrink-0 bg-divider" />
					<div className="p-2.5 flex-col gap-1 bg-secondary rounded">
						<span className="font-semibold">Current Directory:</span>
						<p className="break-words whitespace-normal flex-col">{currentDirectory}</p>
					</div>
				</>
			)}
		</div>
	);
}

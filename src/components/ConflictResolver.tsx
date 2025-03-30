import { CodeFile } from "../types";
import { BackButton } from "./PageStack";
import { FileListItem } from "./FileListItem";

interface ConflictResolverProps {
	conflicts: Array<{
		file: CodeFile;
		localContent: string;
		framerContent: string;
	}>;
	onResolve: (fileId: string, keepLocal: boolean) => Promise<void>;
	onBack: () => void;
}

export function ConflictResolver({ conflicts, onResolve, onBack }: ConflictResolverProps) {
	if (conflicts.length === 0) {
		return null;
	}

	return (
		<div className="p-3 size-full overflow-y-auto flex-col gap-3">
			<BackButton onClick={onBack} />
			<div className="flex-col w-full gap-3">
				<div className="w-full flex-col gap-1">
					<span className="font-semibold">Resolve Conflicts</span>
					<p>
						{conflicts.length > 1
							? "Some files have different content in Framer and on your computer. Choose which version to keep for each file."
							: "This file has different content in Framer and on your computer. Choose which version to keep."}
					</p>
				</div>
				<div className="w-full h-px shrink-0 bg-divider" />
				<div className="flex-col gap-3">
					{conflicts.map(({ file }) => (
						<div key={file.id} className="flex-col gap-1">
							<FileListItem file={file} />
							<div className="flex-row w-full gap-2">
								<button
									className="bg-secondary flex-1 px-2"
									onClick={() => onResolve(file.id, true)}
								>
									Keep Local
								</button>
								<button
									className="bg-secondary flex-1 px-2"
									onClick={() => onResolve(file.id, false)}
								>
									Keep Framer
								</button>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

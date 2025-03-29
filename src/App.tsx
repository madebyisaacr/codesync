import { framer } from "framer-plugin";
import { useEffect, useState } from "react";
import "./App.css";
import { CodeFile, FileMapping, PluginState, SyncStatus } from "./types";
import {
	getFramerCodeFiles,
	getLocalPathFromFramerName,
	loadPluginState,
	savePluginState,
	syncFileToLocal,
} from "./utils";

framer.showUI({
	position: "top left",
	width: 320,
	height: 480,
});

export function App() {
	const [state, setState] = useState<PluginState>({
		localDirectory: null,
		fileMappings: [],
	});
	const [framerFiles, setFramerFiles] = useState<CodeFile[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [directoryInput, setDirectoryInput] = useState("");
	const [isSyncing, setIsSyncing] = useState(false);

	useEffect(() => {
		async function initialize() {
			try {
				const [savedState, files] = await Promise.all([loadPluginState(), getFramerCodeFiles()]);
				setState(savedState);
				setFramerFiles(files);
				if (savedState.localDirectory) {
					setDirectoryInput(savedState.localDirectory);
				}
			} catch (error) {
				console.error("Failed to initialize:", error);
				framer.notify("Failed to initialize plugin", { variant: "error" });
			} finally {
				setIsLoading(false);
			}
		}
		initialize();
	}, []);

	// Subscribe to code file changes
	useEffect(() => {
		// Set up an interval to check for file changes
		const interval = setInterval(async () => {
			const currentFiles = await getFramerCodeFiles();
			setFramerFiles(currentFiles);
		}, 1000); // Check every second

		// Cleanup interval on unmount
		return () => clearInterval(interval);
	}, []);

	const handleDirectoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setDirectoryInput(e.target.value);
	};

	const handleSaveDirectory = async () => {
		if (!directoryInput.trim()) {
			framer.notify("Please enter a directory path", { variant: "warning" });
			return;
		}

		try {
			const newState = {
				...state,
				localDirectory: directoryInput.trim(),
			};
			setState(newState);
			await savePluginState(newState);
			framer.notify(`Directory set to: ${directoryInput.trim()}`, { variant: "success" });
		} catch (error) {
			console.error("Failed to save directory:", error);
			framer.notify("Failed to save directory", { variant: "error" });
		}
	};

	const handleSync = async () => {
		if (!state.localDirectory) {
			framer.notify("Please set a directory first");
			return;
		}

		setIsSyncing(true);
		try {
			// Get all current files from Framer
			const files = await getFramerCodeFiles();

			// Update the files list to reflect current state
			setFramerFiles(files);

			// Sync all files at once
			const syncStatus = await syncFileToLocal(files, state.localDirectory as string);

			if (syncStatus.status === "error") {
				framer.notify(syncStatus.error || "Failed to sync files");
				return;
			}

			// Update file mappings
			const newMappings: FileMapping[] = files.map((file) => ({
				framerFileId: file.id,
				localPath: getLocalPathFromFramerName(file.name, state.localDirectory as string),
				status: {
					status: "synced" as const,
					lastSync: new Date(),
				},
			}));

			// Update state
			setState((prev) => ({
				...prev,
				fileMappings: newMappings,
			}));

			framer.notify("Files synced successfully");
		} catch (error) {
			console.error("Error during sync:", error);
			framer.notify("Failed to sync files");
		} finally {
			setIsSyncing(false);
		}
	};

	if (isLoading) {
		return (
			<div className="container">
				<p>Loading...</p>
			</div>
		);
	}

	return (
		<div className="container">
			<div className="header">
				<h1 className="title">CodeSync</h1>
				<p className="description">Sync your Framer code files with your local file system</p>
			</div>

			<div className="directoryInput">
				<input
					type="text"
					value={directoryInput}
					onChange={handleDirectoryChange}
					placeholder="Enter directory path"
					className="textInput"
				/>
				<button className="button" onClick={handleSaveDirectory}>
					Save Directory
				</button>
			</div>

			{state.localDirectory && (
				<div className="selectedDirectory">Selected: {state.localDirectory}</div>
			)}

			<div className="fileList">
				{framerFiles.map((file) => (
					<div key={file.id} className="fileItem">
						<span className="fileName">{file.name}</span>
						<span
							className={`syncStatus ${
								state.fileMappings.find((m) => m.framerFileId === file.id)?.status.status ||
								"not-synced"
							}`}
						>
							{state.fileMappings.find((m) => m.framerFileId === file.id)?.status.status ||
								"Not synced"}
						</span>
					</div>
				))}
			</div>

			<button
				className={`button syncButton ${isSyncing ? "syncing" : ""}`}
				onClick={handleSync}
				disabled={isSyncing || !state.localDirectory}
			>
				{isSyncing ? "Syncing..." : "Sync Files"}
			</button>
		</div>
	);
}

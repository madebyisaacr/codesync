import { framer } from "framer-plugin";
import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { CodeFile, FileMapping, PluginState, SyncStatus } from "./types";
import {
	getFramerCodeFiles,
	getLocalPathFromFramerName,
	loadPluginState,
	savePluginState,
	performTwoWaySync,
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
	const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

	// Function to perform sync
	const performSync = useCallback(async () => {
		if (!state.localDirectory) {
			return;
		}

		setIsSyncing(true);
		try {
			// Perform two-way sync
			const syncStatus = await performTwoWaySync(state.localDirectory);

			if (syncStatus.status === "error") {
				console.error("Sync error:", syncStatus.error);
				framer.notify(`Sync error: ${syncStatus.error}`, { variant: "error" });
				return;
			}

			// Get updated files from Framer
			const files = await getFramerCodeFiles();
			setFramerFiles(files);

			// Update file mappings
			const newMappings: FileMapping[] = files.map((file) => ({
				framerFileId: file.id,
				localPath: getLocalPathFromFramerName(file.name, state.localDirectory as string),
				status: {
					status: "synced",
					lastSync: new Date(),
				},
			}));

			// Update state with new mappings and sync timestamp
			setState((prev) => ({
				...prev,
				fileMappings: newMappings,
				lastSyncTimestamp: Date.now(),
			}));

			// Show sync results
			if (syncStatus.updatedFiles && syncStatus.updatedFiles.length > 0) {
				framer.notify(`Updated ${syncStatus.updatedFiles.length} files from Framer`, {
					variant: "success",
				});
			}
			if (syncStatus.skippedFiles && syncStatus.skippedFiles.length > 0) {
				framer.notify(`Preserved ${syncStatus.skippedFiles.length} local changes`, {
					variant: "info",
				});
			}
		} catch (error) {
			console.error("Error during sync:", error);
			framer.notify("Error during sync", { variant: "error" });
		} finally {
			setIsSyncing(false);
		}
	}, [state.localDirectory]);

	useEffect(() => {
		async function initialize() {
			try {
				const [savedState, files] = await Promise.all([loadPluginState(), getFramerCodeFiles()]);
				setState(savedState);
				setFramerFiles(files);
				if (savedState.localDirectory) {
					setDirectoryInput(savedState.localDirectory);
					// Perform initial sync if we have a directory
					await performSync();
				}
			} catch (error) {
				console.error("Failed to initialize:", error);
				framer.notify("Failed to initialize plugin", { variant: "error" });
			} finally {
				setIsLoading(false);
			}
		}
		initialize();
	}, [performSync]);

	// Subscribe to code file changes and auto-sync
	useEffect(() => {
		if (!autoSyncEnabled) return;

		// Set up intervals for file checking and syncing
		const fileCheckInterval = setInterval(async () => {
			const currentFiles = await getFramerCodeFiles();
			setFramerFiles(currentFiles);
		}, 1000); // Check files every second

		const syncInterval = setInterval(() => {
			performSync();
		}, 5000); // Sync every 5 seconds

		// Cleanup intervals on unmount or when auto-sync is disabled
		return () => {
			clearInterval(fileCheckInterval);
			clearInterval(syncInterval);
		};
	}, [autoSyncEnabled, performSync]);

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

			// Perform immediate sync when directory is set
			await performSync();
		} catch (error) {
			console.error("Failed to save directory:", error);
			framer.notify("Failed to save directory", { variant: "error" });
		}
	};

	const toggleAutoSync = () => {
		setAutoSyncEnabled(!autoSyncEnabled);
		if (!autoSyncEnabled) {
			framer.notify("Auto-sync enabled");
		} else {
			framer.notify("Auto-sync disabled");
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
				<p className="description">Two-way sync between Framer and your local files</p>
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
						<span className="fileName" title={file.name}>
							{file.name}
						</span>
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
				className={`button syncButton ${isSyncing ? "syncing" : ""} ${
					autoSyncEnabled ? "active" : ""
				}`}
				onClick={toggleAutoSync}
				disabled={!state.localDirectory}
			>
				{isSyncing ? "Syncing..." : autoSyncEnabled ? "Pause Sync" : "Resume Sync"}
			</button>
		</div>
	);
}

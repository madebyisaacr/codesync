import { framer } from "framer-plugin";
import { useEffect, useState } from "react";
import "./App.css";
import { CodeFile, FileMapping, PluginState } from "./types";
import { getFramerCodeFiles, loadPluginState, savePluginState, syncFileToLocal } from "./utils";

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
			framer.notify("Please set a directory first", { variant: "warning" });
			return;
		}

		if (isSyncing) {
			framer.notify("Sync already in progress", { variant: "warning" });
			return;
		}

		setIsSyncing(true);
		try {
			const newMappings: FileMapping[] = [];
			for (const file of framerFiles) {
				const syncStatus = await syncFileToLocal(file, state.localDirectory);
				newMappings.push({
					framerFileId: file.id,
					localPath: file.name,
					status: syncStatus,
				});
			}

			const newState = {
				...state,
				fileMappings: newMappings,
			};
			setState(newState);
			await savePluginState(newState);
			framer.notify("Files synced successfully", { variant: "success" });
		} catch (error) {
			console.error("Failed to sync files:", error);
			framer.notify("Failed to sync files", { variant: "error" });
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

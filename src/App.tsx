import { framer } from "framer-plugin";
import { useEffect, useState, useCallback, useRef } from "react";
import "./App.css";
import { CodeFile, FileMapping, PluginState, FileConflict } from "./types";
import {
	getFramerCodeFiles,
	getLocalPathFromFramerName,
	loadPluginState,
	savePluginState,
	performSync,
} from "./utils";
import classNames from "classnames";
import { DirectoryPage, DirectoryEditor } from "./components/DirectoryEditor";
import { PageStack, usePageStack } from "./components/PageStack";
import { Spinner } from "./components/spinner/Spinner";
import { ConflictResolver } from "./components/ConflictResolver";
import { FileListItem } from "./components/FileListItem";
import CheckIcon from "./components/CheckIcon";

framer.showUI({
	position: "top left",
	width: 300,
	height: 450,
	resizable: true,
});

export function App() {
	return (
		<main className="size-full overflow-hidden select-none">
			<div className="absolute top-0 inset-x-3 h-px bg-divider z-10" />
			<PageStack>
				<HomePage />
			</PageStack>
		</main>
	);
}

function HomePage() {
	const { openPage } = usePageStack();
	const [state, setState] = useState<PluginState>({
		localDirectory: null,
		fileMappings: [],
	});
	const [framerFiles, setFramerFiles] = useState<CodeFile[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSyncing, setIsSyncing] = useState(false);
	const [conflicts, setConflicts] = useState<FileConflict[]>([]);
	const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);
	const [serverError, setServerError] = useState<string | null>(null);
	const [resolvedConflicts, setResolvedConflicts] = useState<
		Array<{ fileId: string; keepLocal: boolean }>
	>([]);
	const [isSyncMode, setIsSyncMode] = useState(false);
	const [hasInitialConflictResolution, setHasInitialConflictResolution] = useState(false);
	const pollInterval = useRef<NodeJS.Timeout>();

	// Cleanup polling on unmount
	useEffect(() => {
		return () => {
			if (pollInterval.current) {
				clearInterval(pollInterval.current);
			}
		};
	}, []);

	// Start polling when entering sync mode
	useEffect(() => {
		if (isSyncMode && state.localDirectory) {
			const directory = state.localDirectory;
			// Poll every 2 seconds for local changes
			pollInterval.current = setInterval(async () => {
				try {
					const syncStatus = await performSync(
						directory,
						resolvedConflicts,
						hasInitialConflictResolution
					);
					if (syncStatus.status === "error") {
						// Only show conflict resolver if we haven't done initial resolution
						if (!hasInitialConflictResolution) {
							setIsSyncMode(false);
							console.log("set sync mode to false");
							const newConflicts: FileConflict[] = await Promise.all(
								syncStatus.conflicts.map(async (conflict) => {
									const file = framerFiles.find((f) => f.id === conflict.fileId);
									if (!file) {
										throw new Error(`File not found: ${conflict.fileId}`);
									}
									return {
										file,
										localContent: conflict.localContent,
										framerContent: conflict.framerContent,
									};
								})
							);
							setConflicts(newConflicts);
							setIsResolvingConflicts(true);
						} else {
							// After initial resolution, always keep local version
							for (const conflict of syncStatus.conflicts) {
								const file = framerFiles.find((f) => f.id === conflict.fileId);
								if (file?.setFileContent) {
									await file.setFileContent(conflict.localContent);
								}
							}
						}
					}

					// Update files and mappings on successful sync
					const files = await getFramerCodeFiles();
					setFramerFiles(files);

					// Update file mappings
					const newMappings: FileMapping[] = files.map((file) => ({
						framerFileId: file.id,
						localPath: getLocalPathFromFramerName(file.name, directory),
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
						console.log(`Updated ${syncStatus.updatedFiles.length} files`);
					}
				} catch (error) {
					console.error("Error during sync polling:", error);
				}
			}, 2000);
		}

		return () => {
			if (pollInterval.current) {
				clearInterval(pollInterval.current);
			}
		};
	}, [isSyncMode, state.localDirectory, framerFiles, hasInitialConflictResolution]);

	useEffect(() => {
		async function initialize() {
			try {
				const [savedState, files] = await Promise.all([loadPluginState(), getFramerCodeFiles()]);
				setState(savedState);
				setFramerFiles(files);
			} catch (error) {
				console.error("Failed to initialize:", error);
				if (
					error instanceof Error &&
					(error.message.includes("Failed to fetch") ||
						error.message.includes("connection refused"))
				) {
					setServerError(
						"Could not connect to local server. Make sure the server is running on port 3000."
					);
				} else {
					framer.notify("Failed to initialize plugin", { variant: "error" });
				}
			} finally {
				setIsLoading(false);
			}
		}
		initialize();
	}, []);

	const handleSaveDirectory = async (directoryInput: string) => {
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

	const onClickSelectDirectory = () => {
		openPage(
			<DirectoryPage
				onSaveDirectory={handleSaveDirectory}
				currentDirectory={state.localDirectory}
			/>
		);
	};

	const handleResolveConflict = async (fileId: string, keepLocal: boolean) => {
		try {
			// Update the file in Framer based on the user's choice
			const file = framerFiles.find((f) => f.id === fileId);
			if (!file) {
				throw new Error(`File not found: ${fileId}`);
			}

			if (keepLocal && file.setFileContent) {
				const conflict = conflicts.find((c) => c.file.id === fileId);
				if (!conflict) {
					throw new Error(`Conflict not found for file: ${fileId}`);
				}
				await file.setFileContent(conflict.localContent);
			}

			// Create updated resolved conflicts array
			const updatedResolvedConflicts = [...resolvedConflicts, { fileId, keepLocal }];
			setResolvedConflicts(updatedResolvedConflicts);

			// Remove the resolved conflict
			const remainingConflicts = conflicts.filter((c) => c.file.id !== fileId);
			setConflicts(remainingConflicts);

			// If this was the last conflict, enter sync mode and start syncing
			if (remainingConflicts.length === 0) {
				setIsResolvingConflicts(false);
				setIsSyncMode(true);
				setHasInitialConflictResolution(true);
				await performSyncOperation(updatedResolvedConflicts);
			}
		} catch (error) {
			console.error("Error resolving conflict:", error);
			framer.notify("Error resolving conflict", { variant: "error" });
		}
	};

	const performSyncOperation = useCallback(
		async (currentResolvedConflicts?: Array<{ fileId: string; keepLocal: boolean }>) => {
			if (!state.localDirectory) {
				return false;
			}

			setIsSyncing(true);
			setServerError(null);
			try {
				const syncStatus = await performSync(
					state.localDirectory,
					currentResolvedConflicts ?? resolvedConflicts,
					hasInitialConflictResolution
				);

				if (syncStatus.status === "error") {
					if (
						syncStatus.error?.includes("Failed to fetch") ||
						syncStatus.error?.includes("connection refused")
					) {
						setServerError(
							"Could not connect to local server. Make sure the server is running on port 3000."
						);
						return false;
					}

					// Handle conflicts if they exist
					if (syncStatus.conflicts && syncStatus.conflicts.length > 0) {
						// Only show conflict resolver on initial sync if we haven't done initial resolution
						if (!hasInitialConflictResolution && !isSyncMode) {
							const newConflicts: FileConflict[] = await Promise.all(
								syncStatus.conflicts.map(async (conflict) => {
									const file = framerFiles.find((f) => f.id === conflict.fileId);
									if (!file) {
										throw new Error(`File not found: ${conflict.fileId}`);
									}
									return {
										file,
										localContent: conflict.localContent,
										framerContent: conflict.framerContent,
									};
								})
							);
							setConflicts(newConflicts);
							setIsResolvingConflicts(true);
							setIsSyncMode(false);
							console.log("set sync mode to false");
						} else {
							// For subsequent syncs or after initial resolution, always keep local version
							for (const conflict of syncStatus.conflicts) {
								const file = framerFiles.find((f) => f.id === conflict.fileId);
								if (file?.setFileContent) {
									await file.setFileContent(conflict.localContent);
								}
							}
						}
						return false;
					}

					console.error("Sync error:", syncStatus.error);
					framer.notify(`Sync error: ${syncStatus.error}`, { variant: "error" });
					return false;
				}

				// Clear resolved conflicts after successful sync
				setResolvedConflicts([]);

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
					console.log(`Updated ${syncStatus.updatedFiles.length} files`);
				}

				// Set initial conflict resolution to true after successful sync
				if (!hasInitialConflictResolution) {
					setHasInitialConflictResolution(true);
				}

				return true;
			} catch (error) {
				console.error("Error during sync:", error);
				if (
					error instanceof Error &&
					(error.message.includes("Failed to fetch") ||
						error.message.includes("connection refused"))
				) {
					setServerError(
						"Could not connect to local server. Make sure the server is running on port 3000."
					);
				} else {
					framer.notify("Error during sync", { variant: "error" });
				}
				return false;
			} finally {
				setIsSyncing(false);
			}
		},
		[state.localDirectory, framerFiles, resolvedConflicts, hasInitialConflictResolution, isSyncMode]
	);

	// Use isResolvingConflicts instead of conflicts.length for rendering
	if (isResolvingConflicts) {
		return (
			<ConflictResolver
				conflicts={conflicts}
				onResolve={handleResolveConflict}
				onBack={() => {
					setIsResolvingConflicts(false);
					setConflicts([]);
				}}
			/>
		);
	}

	// Only show loading state if we're not in conflict resolution
	if (isLoading) {
		return (
			<div className="size-full relative">
				<Spinner />
				<p>Loading...</p>
			</div>
		);
	}

	return (
		<div className="size-full flex-col">
			<div className="p-3 w-full flex-col gap-3 flex-1 overflow-y-auto overflow-x-hidden">
				<p>Sync Framer code files to your local computer.</p>
				{serverError && <div className="bg-error/10 text-error p-2 rounded">{serverError}</div>}
				{isLoading ? (
					"Loading..."
				) : state.localDirectory ? (
					<button onClick={onClickSelectDirectory} className="bg-secondary">
						Change Directory
					</button>
				) : (
					<div className="flex-col gap-3 relative pt-3">
						<div className="flex-col gap-1">
							<div className="absolute top-0 inset-x-0 h-px bg-divider" />
							<span className="font-semibold">Enter your directory path</span>
							<p>
								Enter the path of the folder on your computer that you want to sync Framer code
								files to.
							</p>
						</div>
						<DirectoryEditor
							onSaveDirectory={handleSaveDirectory}
							currentDirectory={state.localDirectory}
						/>
					</div>
				)}
				<div className="w-full h-px shrink-0 bg-divider" />
				<div className="flex-col flex-1">
					<span className="font-semibold mb-2">Code Files</span>
					{framerFiles.length === 0 ? (
						<div className="flex-col pb-4 center text-center gap-1 text-balance flex-1">
							<span>No code files found</span>
							<p>Your Framer project has no files. Create a file to get started with FramerSync.</p>
						</div>
					) : (
						framerFiles.map((file) => {
							const status = state.fileMappings.find((m) => m.framerFileId === file.id)?.status
								.status;
							return (
								<FileListItem key={file.id} file={file}>
									{status && (
										<span
											className={classNames(
												"text-xs rounded capitalize shrink-0",
												status === "error" ? "text-error" : "text-secondary"
											)}
										>
											{status == "synced" ? <CheckIcon /> : status}
										</span>
									)}
								</FileListItem>
							);
						})
					)}
				</div>
			</div>
			{state.localDirectory && (
				<div className="flex-col gap-2 p-3 w-full relative">
					<div className="absolute top-0 inset-x-3 h-px bg-divider" />
					<button
						className="relative framer-button-primary flex-row center gap-2"
						onClick={async () => {
							if (isSyncMode) {
								setIsSyncMode(false);
								if (pollInterval.current) {
									clearInterval(pollInterval.current);
								}
								// Reset sync state when stopping
								setIsSyncing(false);
								setResolvedConflicts([]);
								setConflicts([]);
								setIsResolvingConflicts(false);
								setHasInitialConflictResolution(false);
							} else {
								// Reset sync state before starting
								setIsSyncing(true);
								setResolvedConflicts([]);
								setConflicts([]);
								setIsResolvingConflicts(false);
								setHasInitialConflictResolution(false);
								// Start sync process
								const syncResult = await performSyncOperation();
								// Only set sync mode to true if sync was successful
								if (syncResult) {
									setIsSyncMode(true);
								}
							}
						}}
					>
						{isSyncing && <Spinner inline className="absolute right-2 top-[calc(50%-6px)]" />}
						{isSyncMode ? "Stop Syncing" : "Start Syncing"}
					</button>
				</div>
			)}
		</div>
	);
}

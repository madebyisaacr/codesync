import { framer } from "framer-plugin";
import { useEffect, useState, useCallback } from "react";
import "./App.css";
import { CodeFile, FileMapping, PluginState } from "./types";
import {
	getFramerCodeFiles,
	getLocalPathFromFramerName,
	loadPluginState,
	savePluginState,
	performTwoWaySync,
} from "./utils";
import classNames from "classnames";
import { DirectoryPage, DirectoryEditor } from "./components/DirectoryEditor";
import { PageStack, usePageStack } from "./components/PageStack";
import { Spinner } from "./components/spinner/Spinner";

framer.showUI({
	position: "top left",
	width: 320,
	height: 480,
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
	const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
	const [overflowingFiles, setOverflowingFiles] = useState<Set<string>>(new Set());

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

	useEffect(() => {
		// Check for text overflow
		const checkOverflow = () => {
			const newOverflowingFiles = new Set<string>();
			document.querySelectorAll("[data-filename-container]").forEach((container) => {
				const span = container.querySelector("[data-filename-text]") as HTMLElement;
				if (span && span.scrollWidth > span.offsetWidth) {
					newOverflowingFiles.add(span.dataset.filenameText || "");
				}
			});
			setOverflowingFiles(newOverflowingFiles);
		};

		checkOverflow();
		window.addEventListener("resize", checkOverflow);
		return () => window.removeEventListener("resize", checkOverflow);
	}, [framerFiles]);

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

	const onClickSelectDirectory = () => {
		openPage(
			<DirectoryPage
				onSaveDirectory={handleSaveDirectory}
				currentDirectory={state.localDirectory}
			/>
		);
	};

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
				<p>Two-way sync between Framer and files on your computer.</p>
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
				<div className="flex-col gap-2 flex-1">
					<span className="font-semibold">Code Files</span>
					{framerFiles.length === 0 ? (
						<div className="flex-col pb-4 center text-center gap-1 text-balance flex-1">
							<span>No code files found</span>
							<p>Your Framer project has no files. Create a file to get started with FramerSync.</p>
						</div>
					) : (
						framerFiles.map((file) => {
							const status = state.fileMappings.find((m) => m.framerFileId === file.id)?.status
								.status;
							const isOverflowing = overflowingFiles.has(file.name);
							return (
								<div
									key={file.id}
									className="flex-row justify-between items-center px-2.5 py-2 gap-2 bg-secondary rounded"
								>
									<div className="relative flex-1 min-w-0" data-filename-container>
										<span
											data-filename-text={file.name}
											className={classNames(
												"whitespace-nowrap overflow-hidden block w-full",
												isOverflowing ? "text-right" : "text-left"
											)}
											style={isOverflowing ? { direction: "rtl" } : undefined}
											title={file.name}
										>
											{file.name}
										</span>
										<div
											className={classNames(
												"absolute inset-y-0 w-8",
												isOverflowing ? "left-0" : "right-0"
											)}
											style={{
												opacity: isOverflowing ? 0.9 : 0,
												background: isOverflowing
													? "linear-gradient(to left, transparent, var(--color-bg-secondary))"
													: "linear-gradient(to right, transparent, var(--color-bg-secondary))",
											}}
										/>
									</div>
									<span
										className={classNames(
											"text-xs rounded capitalize shrink-0",
											status === "error" ? "text-error" : "text-secondary"
										)}
									>
										{status || "Not Synced"}
									</span>
								</div>
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
						onClick={toggleAutoSync}
					>
						{isSyncing ? (
							<>
								<Spinner inline />
								Syncing...
							</>
						) : autoSyncEnabled ? (
							"Pause Sync"
						) : (
							"Resume Sync"
						)}
					</button>
				</div>
			)}
		</div>
	);
}

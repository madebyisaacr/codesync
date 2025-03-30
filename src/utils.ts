import { framer } from "framer-plugin";
import {
	CodeFile,
	FileMapping,
	PluginState,
	SyncStatus,
	LocalChanges,
	LocalFileChange,
} from "./types";
import { CodeFile as FramerCodeFile } from "framer-plugin";

export const STORAGE_KEY = "codesync-state";
const SERVER_URL = "http://localhost:3000";

export async function loadPluginState(): Promise<PluginState> {
	const state = await framer.getPluginData(STORAGE_KEY);
	if (!state) {
		return {
			localDirectory: null,
			fileMappings: [],
		};
	}
	return JSON.parse(state);
}

export async function savePluginState(state: PluginState): Promise<void> {
	await framer.setPluginData(STORAGE_KEY, JSON.stringify(state));
}

export async function getFramerCodeFiles(): Promise<CodeFile[]> {
	const files = await framer.unstable_getCodeFiles();
	return files.map((file: FramerCodeFile) => ({
		id: file.id,
		name: file.name,
		content: file.content,
	}));
}

export function getLocalPathFromFramerName(name: string, baseDir: string): string {
	// Convert Framer file name to local path
	// This is a simple implementation - we might want to make this more sophisticated
	return `${baseDir}/${name}`;
}

export function getFramerNameFromLocalPath(path: string): string {
	// Extract file name from local path
	return path.split("/").pop() || "";
}

// Server communication functions
export async function setServerDirectory(directory: string): Promise<boolean> {
	try {
		const response = await fetch(`${SERVER_URL}/set-directory`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ directory }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Failed to set directory");
		}

		return true;
	} catch (error) {
		console.error("Error setting server directory:", error);
		if (error instanceof Error && error.message.includes("Failed to fetch")) {
			throw new Error(
				"Could not connect to local server. Make sure the server is running on port 3000."
			);
		}
		throw error;
	}
}

export async function getLocalChanges(): Promise<LocalChanges> {
	try {
		const response = await fetch(`${SERVER_URL}/local-changes`);
		if (!response.ok) {
			throw new Error("Failed to get local changes");
		}
		return await response.json();
	} catch (error) {
		console.error("Error getting local changes:", error);
		return { changes: [] };
	}
}

async function updateFramerFile(change: LocalFileChange): Promise<void> {
	try {
		const files = await framer.unstable_getCodeFiles();
		const existingFile = files.find((f) => f.name === change.path);

		if (change.type === "unlink") {
			if (existingFile) {
				await existingFile.remove();
			}
		} else if (change.content) {
			if (existingFile) {
				await existingFile.setFileContent(change.content);
			} else {
				await framer.unstable_createCodeFile(change.path, change.content);
			}
		}
	} catch (error) {
		console.error(`Error updating Framer file ${change.path}:`, error);
		throw error;
	}
}

export async function syncLocalChangesToFramer(): Promise<SyncStatus> {
	try {
		const { changes } = await getLocalChanges();
		if (changes.length === 0) {
			return { status: "success" };
		}

		// Process each change
		for (const change of changes) {
			await updateFramerFile(change);
		}

		return { status: "success" };
	} catch (error) {
		return {
			status: "error",
			error: error instanceof Error ? error.message : "Failed to sync local changes",
		};
	}
}

export async function checkForConflicts(localDirectory: string): Promise<SyncStatus> {
	try {
		// First ensure the server knows about our directory
		const directorySet = await setServerDirectory(localDirectory);
		if (!directorySet) {
			return {
				status: "error",
				error: "Failed to set directory on local server",
			};
		}

		// Get files from both local and Framer
		const framerFiles = await getFramerCodeFiles();
		const localFiles = await getLocalFiles(localDirectory);

		// Compare files and find conflicts
		const conflicts: Array<{ fileId: string; localContent: string; framerContent: string }> = [];

		for (const framerFile of framerFiles) {
			const localFile = localFiles.find((f) => f.name === framerFile.name);
			if (localFile && localFile.content !== framerFile.content) {
				conflicts.push({
					fileId: framerFile.id,
					localContent: localFile.content,
					framerContent: framerFile.content,
				});
			}
		}

		return {
			status: conflicts.length > 0 ? "error" : "success",
			conflicts,
		};
	} catch (error) {
		return {
			status: "error",
			error: error instanceof Error ? error.message : "Failed to check for conflicts",
		};
	}
}

async function getLocalFiles(directory: string): Promise<CodeFile[]> {
	try {
		const response = await fetch(`${SERVER_URL}/get-files`);
		if (!response.ok) {
			throw new Error("Failed to get local files");
		}
		return await response.json();
	} catch (error) {
		console.error("Error getting local files:", error);
		return [];
	}
}

// One-way sync function (local to Framer only)
export async function performSync(
	localDirectory: string,
	resolvedConflicts?: Array<{ fileId: string; keepLocal: boolean }>,
	ignoreConflicts: boolean = false
): Promise<SyncStatus> {
	try {
		if (!ignoreConflicts) {
			// First check for conflicts, excluding resolved ones
			const conflictStatus = await checkForConflicts(localDirectory);
			if (conflictStatus.conflicts && conflictStatus.conflicts.length > 0) {
				// Filter out resolved conflicts
				const unresolvedConflicts = conflictStatus.conflicts.filter(
					(conflict) => !resolvedConflicts?.some((resolved) => resolved.fileId === conflict.fileId)
				);
				if (unresolvedConflicts.length > 0) {
					return {
						...conflictStatus,
						conflicts: unresolvedConflicts,
					};
				}
			}
		}

		// If ignoring conflicts or no unresolved conflicts, sync local changes to Framer
		return await syncLocalChangesToFramer();
	} catch (error) {
		return {
			status: "error",
			error: error instanceof Error ? error.message : "Failed to perform sync",
		};
	}
}

export async function syncFileToLocal(
	files: CodeFile[],
	localDirectory: string
): Promise<SyncStatus> {
	try {
		// First ensure the server knows about our directory
		const directorySet = await setServerDirectory(localDirectory);
		if (!directorySet) {
			return {
				status: "error",
				error: "Failed to set directory on local server",
			};
		}

		// Add timestamps to files
		const filesWithTimestamps = files.map((file) => ({
			...file,
			timestamp: Date.now(),
		}));

		// Sync all files at once
		const response = await fetch(`${SERVER_URL}/sync-directory`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ files: filesWithTimestamps }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Failed to sync directory");
		}

		const result = await response.json();
		console.log("Sync result:", result);

		return {
			status: "success",
			skippedFiles: result.skipped || [],
			updatedFiles: result.updated || [],
		};
	} catch (error) {
		console.error("Error syncing files:", error);
		return {
			status: "error",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

// Two-way sync function
export async function performTwoWaySync(localDirectory: string): Promise<SyncStatus> {
	try {
		// First sync local changes to Framer
		const localSyncStatus = await syncLocalChangesToFramer();
		if (localSyncStatus.status === "error") {
			return localSyncStatus;
		}

		// Then sync Framer changes to local
		const framerFiles = await getFramerCodeFiles();
		const framerSyncStatus = await syncFileToLocal(framerFiles, localDirectory);

		return framerSyncStatus;
	} catch (error) {
		return {
			status: "error",
			error: error instanceof Error ? error.message : "Failed to perform two-way sync",
		};
	}
}

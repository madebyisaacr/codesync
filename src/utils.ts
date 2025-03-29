import { framer } from "framer-plugin";
import { CodeFile, FileMapping, PluginState, SyncStatus } from "./types";
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

export async function writeFileToServer(fileName: string, content: string): Promise<boolean> {
	try {
		const response = await fetch(`${SERVER_URL}/write-file`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ fileName, content }),
		});

		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.error || "Failed to write file");
		}

		return true;
	} catch (error) {
		console.error("Error writing file to server:", error);
		if (error instanceof Error && error.message.includes("Failed to fetch")) {
			throw new Error(
				"Could not connect to local server. Make sure the server is running on port 3000."
			);
		}
		throw error;
	}
}

export async function syncFileToLocal(file: CodeFile, localDirectory: string): Promise<SyncStatus> {
	try {
		// First ensure the server knows about our directory
		const directorySet = await setServerDirectory(localDirectory);
		if (!directorySet) {
			return {
				status: "error",
				error: "Failed to set directory on local server",
			};
		}

		// Write the file
		const success = await writeFileToServer(file.name, file.content);
		if (!success) {
			return {
				status: "error",
				error: "Failed to write file to local system",
			};
		}

		return {
			status: "synced",
			lastSync: new Date(),
		};
	} catch (error) {
		console.error("Error syncing file:", error);
		return {
			status: "error",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

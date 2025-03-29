export interface CodeFile {
	id: string;
	name: string;
	content: string;
}

export interface SyncStatus {
	status: "success" | "error";
	error?: string;
}

export interface FileMapping {
	framerFileId: string;
	localPath: string;
	status: {
		status: "synced" | "syncing" | "error" | "success" | "conflict";
		lastSync?: Date;
		error?: string;
		localTimestamp?: number;
		framerTimestamp?: number;
	};
}

export interface PluginState {
	localDirectory: string | null;
	fileMappings: FileMapping[];
	lastSyncTimestamp?: number;
}

export interface LocalFileChange {
	type: "add" | "change" | "unlink";
	path: string;
	content?: string;
	timestamp: number;
}

export interface LocalChanges {
	changes: LocalFileChange[];
}

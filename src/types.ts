export interface CodeFile {
	id: string;
	name: string;
	content: string;
	timestamp?: number;
	setFileContent?: (content: string) => Promise<void>;
}

export interface SyncStatus {
	status: "success" | "error";
	error?: string;
	skippedFiles?: string[];
	updatedFiles?: string[];
	conflicts?: Array<{
		fileId: string;
		localContent: string;
		framerContent: string;
	}>;
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
	hasResolvedInitialConflicts?: boolean;
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

export interface FileConflict {
	file: CodeFile;
	localContent: string;
	framerContent: string;
}

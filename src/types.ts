export interface CodeFile {
	id: string;
	name: string;
	content: string;
}

export interface SyncStatus {
	status: "synced" | "syncing" | "error";
	lastSync?: Date;
	error?: string;
}

export interface FileMapping {
	framerFileId: string;
	localPath: string;
	status: SyncStatus;
}

export interface PluginState {
	localDirectory: string | null;
	fileMappings: FileMapping[];
}

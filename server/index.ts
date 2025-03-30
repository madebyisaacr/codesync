import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";
import chokidar from "chokidar";

const app = express();
const port = 3000;

// Enable CORS for the Framer plugin
app.use(cors());
app.use(express.json());

// Store the current working directory and watcher
let currentDirectory: string | null = null;
let watcher: chokidar.FSWatcher | null = null;

// Store local changes
interface FileChange {
	type: "add" | "change" | "unlink";
	path: string;
	content?: string;
	timestamp: number;
}

let localChanges: FileChange[] = [];

// Initialize or update the file watcher
async function setupWatcher(directory: string) {
	// Clean up existing watcher if any
	if (watcher) {
		await watcher.close();
	}

	watcher = chokidar.watch(directory, {
		ignored: /(^|[\/\\])\../, // ignore dotfiles
		persistent: true,
		ignoreInitial: true,
	});

	watcher
		.on("add", async (filePath) => {
			try {
				const content = await fs.readFile(filePath, "utf-8");
				const relativePath = path.relative(directory, filePath);
				localChanges.push({
					type: "add",
					path: relativePath,
					content,
					timestamp: Date.now(),
				});
			} catch (error) {
				console.error(`Error reading new file ${filePath}:`, error);
			}
		})
		.on("change", async (filePath) => {
			try {
				const content = await fs.readFile(filePath, "utf-8");
				const relativePath = path.relative(directory, filePath);
				localChanges.push({
					type: "change",
					path: relativePath,
					content,
					timestamp: Date.now(),
				});
			} catch (error) {
				console.error(`Error reading changed file ${filePath}:`, error);
			}
		})
		.on("unlink", (filePath) => {
			const relativePath = path.relative(directory, filePath);
			localChanges.push({
				type: "unlink",
				path: relativePath,
				timestamp: Date.now(),
			});
		});
}

// Set the working directory
app.post("/set-directory", async (req, res) => {
	try {
		const { directory } = req.body;
		if (!directory) {
			return res.status(400).json({ error: "Directory path is required" });
		}

		// Verify the directory exists and is accessible
		await fs.access(directory);
		currentDirectory = directory;

		// Setup file watcher
		await setupWatcher(directory);

		res.json({ success: true, directory });
	} catch (error) {
		console.error("Error setting directory:", error);
		res.status(500).json({ error: "Failed to set directory" });
	}
});

// Get local changes since last sync
app.get("/local-changes", async (req, res) => {
	if (!currentDirectory) {
		return res.status(400).json({ error: "Directory not set" });
	}

	const changes = [...localChanges];
	localChanges = []; // Clear the changes after sending
	res.json({ changes });
});

// Full directory sync from Framer to local
app.post("/sync-directory", async (req, res) => {
	try {
		if (!currentDirectory) {
			return res.status(400).json({ error: "Directory not set" });
		}

		const { files } = req.body;
		if (!Array.isArray(files)) {
			return res.status(400).json({ error: "Files array is required" });
		}

		// Get list of existing files in the directory
		const existingFiles = await fs.readdir(currentDirectory, { recursive: true });

		// Create a map of filenames from Framer
		const framerFiles = new Map(files.map((f) => [f.name, f.content]));

		// Track results
		const results = {
			skipped: [] as string[],
			updated: [] as string[],
			deleted: [] as string[],
		};

		// Handle existing files
		for (const file of existingFiles) {
			const framerContent = framerFiles.get(file);
			if (!framerContent) {
				// File exists locally but not in Framer - don't delete it
				continue;
			}

			try {
				const fullPath = path.join(currentDirectory, file);
				await fs.writeFile(fullPath, framerContent, "utf-8");
				results.updated.push(file);
			} catch (error) {
				console.error(`Error processing file ${file}:`, error);
			}
		}

		// Add new files from Framer
		for (const [name, content] of framerFiles) {
			if (!existingFiles.includes(name)) {
				try {
					const fullPath = path.join(currentDirectory, name);
					const directory = path.dirname(fullPath);
					await fs.mkdir(directory, { recursive: true });
					await fs.writeFile(fullPath, content, "utf-8");
					results.updated.push(name);
				} catch (error) {
					console.error(`Error writing new file ${name}:`, error);
				}
			}
		}

		res.json({
			success: true,
			...results,
		});
	} catch (error) {
		console.error("Error syncing directory:", error);
		res.status(500).json({ error: "Failed to sync directory" });
	}
});

// Get the current directory
app.get("/current-directory", (_, res) => {
	res.json({ directory: currentDirectory });
});

app.post("/write-file", async (req, res) => {
	if (!currentDirectory) {
		res.status(400).json({ error: "No directory set" });
		return;
	}

	const { fileName, content } = req.body;
	if (!fileName || content === undefined) {
		res.status(400).json({ error: "Missing fileName or content" });
		return;
	}

	try {
		const fullPath = path.join(currentDirectory, fileName);
		// Ensure the directory exists
		const directory = path.dirname(fullPath);
		await fs.mkdir(directory, { recursive: true });
		// Write the file
		await fs.writeFile(fullPath, content);
		res.json({ message: "File written successfully" });
	} catch (error) {
		console.error("Error writing file:", error);
		res.status(500).json({ error: "Failed to write file" });
	}
});

// Get list of files in the directory
app.get("/get-files", async (req, res) => {
	try {
		if (!currentDirectory) {
			return res.status(400).json({ error: "Directory not set" });
		}

		const files: Array<{ name: string; content: string }> = [];
		await walkDirectory(currentDirectory, files);
		res.json(files);
	} catch (error) {
		console.error("Error getting files:", error);
		res.status(500).json({ error: "Failed to get files" });
	}
});

async function walkDirectory(dir: string, files: Array<{ name: string; content: string }>) {
	const entries = await fs.readdir(dir, { withFileTypes: true });

	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		const relativePath = path.relative(currentDirectory!, fullPath);

		if (entry.isDirectory()) {
			await walkDirectory(fullPath, files);
		} else {
			try {
				const content = await fs.readFile(fullPath, "utf-8");
				files.push({
					name: relativePath,
					content,
				});
			} catch (error) {
				console.error(`Error reading file ${fullPath}:`, error);
			}
		}
	}
}

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

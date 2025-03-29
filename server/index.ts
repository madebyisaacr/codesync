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

		// Create a set of filenames from Framer
		const framerFiles = new Set(files.map((f) => f.name));

		// Delete files that don't exist in Framer
		const deletedFiles = [];
		for (const file of existingFiles) {
			if (!framerFiles.has(file)) {
				try {
					const fullPath = path.join(currentDirectory, file);
					await fs.unlink(fullPath);
					deletedFiles.push(file);
					console.log(`Deleted file: ${file}`);
				} catch (error) {
					console.error(`Error deleting file ${file}:`, error);
				}
			}
		}

		// Write or update files from Framer
		const updatedFiles = [];
		for (const file of files) {
			try {
				const fullPath = path.join(currentDirectory, file.name);
				// Ensure the directory exists before writing
				const directory = path.dirname(fullPath);
				await fs.mkdir(directory, { recursive: true });

				await fs.writeFile(fullPath, file.content, "utf-8");
				updatedFiles.push(file.name);
				console.log(`Updated file: ${file.name}`);
			} catch (error) {
				console.error(`Error writing file ${file.name}:`, error);
			}
		}

		res.json({
			success: true,
			deletedFiles,
			updatedFiles,
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

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

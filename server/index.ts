import express from "express";
import cors from "cors";
import fs from "fs/promises";
import path from "path";

const app = express();
const port = 3000;

// Enable CORS for the Framer plugin
app.use(cors());
app.use(express.json());

// Store the current working directory
let currentDirectory: string | null = null;

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
		res.json({ success: true, directory });
	} catch (error) {
		console.error("Error setting directory:", error);
		res.status(500).json({ error: "Failed to set directory" });
	}
});

// Full directory sync
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
		const existingFiles = await fs.readdir(currentDirectory);

		// Create a set of filenames from Framer
		const framerFiles = new Set(files.map((f) => f.name));

		// Delete files that don't exist in Framer
		const deletedFiles = [];
		for (const file of existingFiles) {
			if (!framerFiles.has(file)) {
				try {
					await fs.unlink(path.join(currentDirectory, file));
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
				await fs.writeFile(path.join(currentDirectory, file.name), file.content, "utf-8");
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

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

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

// Write a file
app.post("/write-file", async (req, res) => {
	try {
		if (!currentDirectory) {
			return res.status(400).json({ error: "Directory not set" });
		}

		const { fileName, content } = req.body;
		if (!fileName || content === undefined) {
			return res.status(400).json({ error: "File name and content are required" });
		}

		const filePath = path.join(currentDirectory, fileName);
		await fs.writeFile(filePath, content, "utf-8");
		res.json({ success: true, filePath });
	} catch (error) {
		console.error("Error writing file:", error);
		res.status(500).json({ error: "Failed to write file" });
	}
});

// Get the current directory
app.get("/current-directory", (_, res) => {
	res.json({ directory: currentDirectory });
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});

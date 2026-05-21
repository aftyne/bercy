#!/usr/bin/env node

const express = require("express");
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs").promises;
const path = require("path");

const execAsync = util.promisify(exec);
const app = express();
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");

// If --port exists and has a value, use it. Otherwise, default to 5000.
const PORT = portIndex !== -1 && args[portIndex + 1] ? parseInt(args[portIndex + 1], 10) : 5000;

// Block cross-site requests
app.use((req, res, next) => {
  const origin = req.get("origin");
  const host = req.get("host");

  // Allow requests only if they come from exactly our localhost port
  if (origin && origin !== `http://localhost:${PORT}`) {
    return res.status(403).json({ error: "Forbidden: Invalid Origin" });
  }

  if (host !== `localhost:${PORT}` && host !== `127.0.0.1:${PORT}`) {
    return res.status(403).json({ error: "Forbidden: Invalid Host" });
  }

  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const IGNORE_FILE_PATH = path.join(process.cwd(), ".bercyignore");

// Read ignored files
async function getIgnoredFiles() {
  try {
    const data = await fs.readFile(IGNORE_FILE_PATH, "utf8");
    return data
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err) {
    return []; // File doesn't exist yet
  }
}

// Save ignored files
async function saveIgnoredFiles(filesArray) {
  // Deduplicate and filter empty strings
  const uniqueFiles = [...new Set(filesArray)].filter(Boolean);
  await fs.writeFile(IGNORE_FILE_PATH, uniqueFiles.join("\n"), "utf8");
}

const extractFiles = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    let results = [];

    // Fallback: in case Knip puts it in a 'files' array
    if (Array.isArray(data.files)) {
      results = results.concat(data.files.map((f) => (typeof f === "string" ? f : f.file)));
    }

    // Main extraction
    if (Array.isArray(data.issues)) {
      const issueFiles = data.issues.map((i) => i.file || i.name).filter(Boolean);
      results = results.concat(issueFiles);
    }

    // Remove duplicates and clean it up
    return Array.from(new Set(results)).filter(Boolean);
  } catch (e) {
    console.error("❌ Failed to parse JSON:", jsonString.substring(0, 100));
    return [];
  }
};

let isScanning = false;

// GET: Scan for unused files
app.get("/api/knip", async (req, res) => {
  const execOptions = { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 };
  const command =
    process.platform === "win32"
      ? "npx.cmd --yes knip --include files --reporter json"
      : "npx --yes knip --include files --reporter json";

  if (isScanning) {
    return res.status(429).json({ error: "Scan already in progress. Please wait." });
  }

  isScanning = true;

  try {
    const { stdout } = await execAsync(command, execOptions);
    // If it finds 0 files, it exits here
    res.json({ files: extractFiles(stdout) });
  } catch (error) {
    // If Knip finds files, it exits with Code 1 and lands here.
    // We grab error.stdoutand return it as a successful response
    if (error.stdout) {
      const rawPaths = extractFiles(error.stdout);
      const ignoredPaths = await getIgnoredFiles();

      // Filter out anything that exists in the ignore list
      const unusedFiles = rawPaths.filter((file) => !ignoredPaths.includes(file));

      return res.json({
        files: unusedFiles,
        ignored: ignoredPaths, // Send the ignored list to the frontend too!
      });
    }

    // Only throw an actual 500 error if Knip completely failed to run
    console.error("Knip execution completely failed:", error.message);
    res.status(500).json({ error: "Failed to execute Knip", details: error.message });
  } finally {
    isScanning = false;
  }
});

// DELETE: Trash the file(s)
app.delete("/api/knip", async (req, res) => {
  try {
    // Support both single deletion (filePath) AND bulk deletion (filePaths)
    const pathsToDelete = req.body.filePaths || (req.body.filePath ? [req.body.filePath] : []);

    if (pathsToDelete.length === 0) {
      return res.status(400).json({ error: "No file paths provided" });
    }

    let deletedCount = 0;

    // Loop through the array and physically delete them
    for (let file of pathsToDelete) {
      // Strip out null bytes and ensure the path is just a string
      if (typeof file !== "string" || file.includes("\0")) continue;

      // Normalize the path and strip any leading slashes or ".."
      // This forces the path to be strictly relative to the project root
      const safeRelativePath = path
        .normalize(file)
        .replace(/^(\.\.(\/|\\|$))+/, "")
        .replace(/^[/\\]+/, "");
      const fullPath = path.join(process.cwd(), safeRelativePath);

      // Final Security check: Ensure it's inside the project
      if (fullPath.startsWith(process.cwd())) {
        try {
          await fs.unlink(fullPath);
          deletedCount++;
        } catch (unlinkErr) {
          console.log(`⚠️ Skipped or failed to delete: ${safeRelativePath}`);
        }
      }
    }

    // Send back success and how many files were actually trashed
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Server Delete Error:", error);
    res.status(500).json({ error: "Failed to process deletion request" });
  }
});

// GET: Framework target
app.get("/api/meta", async (req, res) => {
  try {
    const packageJsonPath = path.join(process.cwd(), "package.json");
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));

    // Combine dependencies and devDependencies to check both
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    let framework = "Node.js";
    let version = process.version; // Fallback to Node version

    // Check for framework wrappers before underlying libraries
    if (allDeps.next) {
      framework = "Next.js";
      version = allDeps.next;
    } else if (allDeps.nuxt) {
      framework = "Nuxt";
      version = allDeps.nuxt;
    } else if (allDeps.react) {
      framework = "React";
      version = allDeps.react;
    } else if (allDeps.vue) {
      framework = "Vue";
      version = allDeps.vue;
    }

    // Clean version string (e.g., change "^14.2.3" to "14.2.3")
    const cleanVersion = version.replace(/[\^~]/g, "");

    res.json({
      projectName: packageJson.name || "Current Project",
      framework,
      version: cleanVersion,
    });
  } catch (error) {
    res.json({ projectName: "Unknown Project", framework: "Unknown", version: "0.0.0" });
  }
});

// Add files to .bercyignore
app.post("/api/ignore", async (req, res) => {
  const { filePaths } = req.body;
  if (!Array.isArray(filePaths)) return res.status(400).json({ error: "Invalid payload" });

  const currentIgnored = await getIgnoredFiles();
  await saveIgnoredFiles([...currentIgnored, ...filePaths]);

  res.json({ success: true });
});

// Remove files from .bercyignore (Restore)
app.post("/api/unignore", async (req, res) => {
  const { filePaths } = req.body;
  if (!Array.isArray(filePaths)) return res.status(400).json({ error: "Invalid payload" });

  const currentIgnored = await getIgnoredFiles();
  const updatedIgnored = currentIgnored.filter((file) => !filePaths.includes(file));

  await saveIgnoredFiles(updatedIgnored);
  res.json({ success: true });
});

// Start the server
const server = app.listen(PORT, async () => {
  console.log(`\n✨ Bercy is running!`);
  console.log(`💻 Dashboard available at http://localhost:${PORT}\n`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`💡 Try specifying a different port: bercy --port ${PORT + 1}\n`);
    process.exit(1);
  } else {
    console.error(err);
  }
});

#!/usr/bin/env node

const express = require("express");
const { exec } = require("child_process");
const util = require("util");
const fs = require("fs").promises;
const path = require("path");

const execAsync = util.promisify(exec);
const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 1. Updated extraction logic to perfectly match your screenshot's JSON structure
const extractFiles = (jsonString) => {
  try {
    const data = JSON.parse(jsonString);
    let results = [];

    // Fallback: in case Knip puts it in a 'files' array
    if (Array.isArray(data.files)) {
      results = results.concat(data.files.map((f) => (typeof f === "string" ? f : f.file)));
    }

    // Main extraction: based on your screenshot's "issues" array
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

// --- GET: Scan for unused files ---
app.get("/api/knip", async (req, res) => {
  const execOptions = { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 };
  const command =
    process.platform === "win32"
      ? "npx.cmd --yes knip --include files --reporter json"
      : "npx --yes knip --include files --reporter json";

  try {
    const { stdout } = await execAsync(command, execOptions);
    // If it finds 0 files, it exits cleanly here
    res.json({ files: extractFiles(stdout) });
  } catch (error) {
    // 2. CRITICAL FIX: If Knip finds files, it exits with Code 1 and lands here.
    // We grab error.stdout (from your screenshot) and return it as a SUCCESSFUL response!
    if (error.stdout) {
      const unusedFiles = extractFiles(error.stdout);
      return res.json({ files: unusedFiles });
    }

    // Only throw an actual 500 error if Knip completely failed to run
    console.error("Knip execution completely failed:", error.message);
    res.status(500).json({ error: "Failed to execute Knip", details: error.message });
  }
});

// --- DELETE: Trash the file(s) ---
app.delete("/api/knip", async (req, res) => {
  try {
    // 1. Support both single deletion (filePath) AND bulk deletion (filePaths)
    const pathsToDelete = req.body.filePaths || (req.body.filePath ? [req.body.filePath] : []);

    if (pathsToDelete.length === 0) {
      return res.status(400).json({ error: "No file paths provided" });
    }

    let deletedCount = 0;

    // 2. Loop through the array and physically delete them
    for (const file of pathsToDelete) {
      const fullPath = path.join(process.cwd(), file);

      // 3. Security check: Ensure they aren't trying to delete system files outside the project
      if (fullPath.startsWith(process.cwd())) {
        try {
          await fs.unlink(fullPath);
          deletedCount++;
        } catch (unlinkErr) {
          // If a specific file fails (e.g., already deleted), just log it and move to the next one
          console.log(`⚠️ Skipped or failed to delete: ${file}`);
        }
      }
    }

    // 4. Send back success and how many files were actually trashed
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Server Delete Error:", error);
    res.status(500).json({ error: "Failed to process deletion request" });
  }
});

// Start the server
app.listen(PORT, async () => {
  console.log(`\n🚀 Bercy is running!`);
  console.log(`🌍 Dashboard available at http://localhost:${PORT}\n`);

  // const open = (await import("open")).default;
  // await open(`http://localhost:${PORT}`);
});

# Bercy

A framework-agnostic CLI utility to safely bulk-delete unused files.

**Do not install this globally or as a project dependency.** Run it directly in your project root using:

```bash
npx @aftyne/bercy

```

Built on top of the [Knip](https://knip.dev/) engine, Bercy spins up a secure local server to help you visualize dead code and eliminate it with a few clicks.

## Features

* **Zero Configuration:** Run it in any JavaScript/TypeScript project. No setup files required.
* **Interactive Dashboard:** A minimalist, dark-themed UI to review unused files before making any destructive changes.
* **Bulk Processing:** Select multiple files and delete them in one single batch.
* **Persistent Ignore List:** Ignoring a file automatically generates and updates a `.bercyignore` file in your project root. These files are hidden from future scans, and you can restore them directly from the dashboard.
* **Network Isolation:** The server locks strictly to `127.0.0.1` to prevent local network exposure.
* **Path Sanitization:** Aggressive backend checks prevent directory traversal outside your project boundaries.

## Options

If the default port (`3001`) is already in use, you can specify a custom port using the `--port` flag:

```bash
npx @aftyne/bercy --port 8080

```

## How It Works

1. Bercy leverages `knip` under the hood to perform a static analysis of your codebase, finding files that are never imported or used.
2. The Node.js backend filters the results against your `.bercyignore` file and serves a lightweight frontend.
3. When you trigger an action, the backend verifies the paths and safely executes the file system changes.

## Tech Stack

* **Backend:** Node.js, Express
* **Frontend:** HTML, Javascript, TailwindCSS (CDN)
* **Core Engine:** Knip

## License

[MIT License](https://www.google.com/search?q=LICENSE)
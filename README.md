# Bercy

A framework-agnostic CLI utility and interactive local dashboard designed to identify and safely bulk-delete unused files in modern JavaScript and TypeScript repositories. It replaces tedious manual cleanup with a fast, precise, and visual workflow.

Built on top of the powerful [Knip](https://knip.dev/) engine, Bercy spins up a secure local server to help you visualize dead code and eliminate it with a few clicks.

## Features

* **Zero Configuration:** Run it in any JavaScript/TypeScript project. No setup files required.
* **Framework Agnostic:** Automatically detects and displays your project's framework (Next.js, React, Vue, Nuxt, Node.js, etc.).
* **Interactive Dashboard:** A minimalist, dark-themed UI to review unused files before deletion.
* **Bulk Deletion:** Select multiple files and delete them in one batch.
* **Secure by Design:** Locked strictly to `127.0.0.1` to prevent local network exposure.
* Built-in CSRF protection to block drive-by web attacks.
* Aggressive path sanitization to prevent directory traversal outside your project.



## Usage

You do not need to install Bercy globally or add it to your project dependencies. Simply run it directly in the root of your target project using `npx`:

```bash
npx @aftyne/bercy

```

This will automatically:

1. Scan your project for unused files and dependencies.
2. Spin up a secure local Express server.
3. Open the interactive dashboard in your default web browser.

### Options

If the default port (`5000`) is already in use by another application, you can specify a custom port using the `--port` flag:

```bash
npx @aftyne/bercy --port 8080

```

## How It Works

1. **Analysis:** Bercy leverages `knip` under the hood to perform a comprehensive static analysis of your codebase, finding exports, files, and dependencies that are never used.
2. **Dashboard:** The Node.js backend serves a lightweight, Vanilla JS and TailwindCSS frontend.
3. **Execution:** When you trigger a deletion, the backend safely maps the relative paths, verifies they exist within your project boundaries, and permanently removes them from the file system.

## Tech Stack

* **Backend:** Node.js, Express
* **Frontend:** HTML, JavaScript, TailwindCSS
* **Core Engine:** Knip

## License

[MIT](https://opensource.org/licenses/MIT)

Copyright (c) 2026-present, Ahmad Dwi Aftiyan (aftyne)

# Filesystem Helpers

This folder contains the base filesystem utilities used throughout the app.

The goal is to keep all direct interaction with the filesystem in one place so the rest of the codebase doesn't need to know about Tauri's filesystem APIs.

## Responsibilities

* Read and write files
* Create folders
* Delete files or folders
* Check if paths exist
* List directory contents
* Read and write app configuration
* Build workspace paths

## Structure

* `fs.ts` — Low-level filesystem helpers (read, write, mkdir, delete, exists, etc.).
* `paths.ts` — Workspace path helpers for resolving directories and file locations.

## Usage

Higher-level modules (documents, templates, assets, scratchpads, outputs, etc.) should use these helpers instead of calling Tauri filesystem APIs directly.

This keeps filesystem logic centralized, consistent, and easy to change in the future.

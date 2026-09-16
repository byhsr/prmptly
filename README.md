# prmptly

**One place to design every kind of prompt and agent.**

prmptly is a local-first desktop app for writing, organising and shipping prompts — quick things you paste straight into a chat, structured prompts built from sections, reusable templates and snippets, portable agent skills, and a canvas for sketching agent flows.

Everything lives on your machine. No account, no sign-in, works offline.

---

## Download

**[Get the latest release →](https://github.com/byhsr/prmptly/releases/latest)**

| Platform | File | Notes |
| --- | --- | --- |
| Windows | `prmptly_0.1.0_x64-setup.exe` | Installer — recommended |
| Windows | `prmptly_0.1.0_x64_en-US.msi` | For managed installs |
| Linux | `prmptly_0.1.0_amd64.AppImage` | Recommended — this one self-updates |
| Linux | `.deb` / `.rpm` | Won't receive in-app updates |

> On first launch Windows may show a SmartScreen warning ("Windows protected your PC") because the installer isn't Authenticode-signed yet. Choose **More info → Run anyway**.

macOS isn't available yet — it needs a signed and notarised build first.

## Updates

prmptly checks for a new version **every time it launches**. When one exists you'll see a notice in the top-right with the release notes and an **update now** button — it downloads, installs and restarts for you. You can also check on demand from **Settings → About**.

On Linux, only the **AppImage** can update itself. If you installed the `.deb` or `.rpm`, grab new versions from the releases page.

## What's inside

**Quicks** — a single markdown document, one editor, no ceremony. For anything you want to paste straight into a model. Headings are picked up on demand so you get an outline, and the plain output is your markdown exactly as you wrote it.

**Prompt builder** — compose a prompt out of sections, drag them into the order you want, and pull in templates and snippets with `@`. The output panel renders the same prompt as **plain text, JSON or XML**, whichever your target expects.

**Templates & snippets** — templates are blueprints you clone to start a new document. Snippets are simple key/value pairs you can drop in anywhere.

**Skills & graph** — agent skills are portable `SKILL.md` files. Group them, import and export them, and view them as a real node graph where skills link up through shared groups and templates.

**Canvas** — a visual, node-based space for sketching out agent flows.

**Your workspace**

- **Vaults** — self-contained folders, each with its own database, so separate projects never bleed into each other. Switch from the top bar.
- **Scratchpad** — a folder per document holding `notes.md`, `canvas.json` and `attachments/`.
- **Outline** — jump to any heading, with a short highlight where you land.
- **Find & replace** — across a document, with case-sensitive and whole-word toggles.
- **Stats** — live character, word and token counts in the editor header.
- **Themes & fonts** — dark, light and cyberpunk, with configurable heading, body and mono fonts.

## Built for big prompts

prmptly is designed for the content people actually put in front of agents — tens of thousands of words at a time — without the editor falling over.

## Where your data lives

- Content is stored as files inside your vault folder, with metadata in a local SQLite database.
- AI API keys are kept **locally**. They are never logged and never included in the prompts sent to a provider.
- Nothing is uploaded anywhere. The only network calls are the ones you make to an AI provider you configured, plus the update check.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + S` | Save the current document |
| `Ctrl + O` | Toggle the outline panel |

## Status

**v0.1.0** — early. Windows and Linux builds are available; macOS isn't supported yet.

Found a bug or have an idea? [Open an issue](https://github.com/byhsr/prmptly/issues).

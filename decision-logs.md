# Goal is to be core of prompting , every kind of prompting and agent design happens here 

## quicks 
- paste external prompts and see how they go, make quick additions, save in the vault/folder
- markdown parser, ( in settings change sizes and themes for markdown )

## Prompt 
- Agent builder -> flow chart designer 
- sections, use templates, -> select a template match to the core flow and make changes with LLM

## Workspaces
- add different Workspaces within the base directory, so different vaults has clean separation of concerns


## New architecture 
- removed local rag Fast Embeddig 
- better workspace directory for clean separation of concerns 
- Cloud sync native architecture 
- Agents 

--
08/07
- all prompts are just documents with editable sections add comments with type quick | Prompt

## Document Storage

* Each workspace has its own SQLite database located at `.prmptly/app.db`.
* SQLite stores metadata, relationships, indexing, search, and document structure.
* Large or editable content is stored on the filesystem.
* File paths are **not** stored in the database. They are deterministic and derived from the document ID.

### Workspace Structure

```text
Workspace/
│
├── .prmptly/
│   └── app.db
│
├── documents/
│   ├── <document-id>/
│   │   ├── scratchpad.md
│   │   ├── scratchpad.flow.json
│   │   └── output.json
│   └── ...
│
├── templates/
├── library/
└── assets/
```

### Documents

A document is the primary editable entity. It owns its sections, scratchpad, canvas, and generated output.

Database stores:

* id
* type (`prompt` | `quick`)
* name
* templateId
* collectionId
* sections (`DocumentSection[]`)
* meta
* createdAt
* updatedAt

Filesystem stores:

* `scratchpad.md`
* `scratchpad.flow.json`
* `output.json`

### Sections

* Documents own their own `DocumentSection[]`.
* Templates act only as blueprints for creating new documents.
* Once created, sections are independent and can be reordered, renamed, deleted, duplicated, or edited without affecting the template.

### Markdown Convention

* `#` → Document title
* `##` → Document section
* `###+` → Headings inside a section (formatting only)

Only `##` creates a new `DocumentSection`.

### Output Generation

`buildOutput()` converts `DocumentSection[]` into the selected output format (`plain`, `json`, or `xml`).

It is a pure function and does not read/write files or interact with the database. 
output is never stored : copy button always just builds the output and copy pastes to your clipboard or users can simply download the output which generates the output file 

### Local-First Principle

SQLite manages metadata and querying, while the filesystem stores document content. Since file locations are deterministic from the document ID, no file paths are persisted in the database.

---

## Session Log — 26/07

### Fixed: TabBar disappearing on large paste
- **Root cause**: `position: sticky` on TabBar breaks when a shared ancestor gets `overflow: auto/hidden` from large content reflow
- **Fix**: Decoupled TabBar from scroll container — App.tsx layout is now a flex column with `height: 100vh`. TabBar has `flexShrink: 0` above a `flex: 1; minHeight: 0; overflow: hidden` content area. Removed `sticky` from TabBar entirely since it's structurally pinned.
- **Also added**: ErrorBoundary per section (TabBar + AppFlow separate)

### Fixed: Large paste crash in quicks
- Switched HomeView editors from Tiptap `SmartEditor` to `<div contentEditable>` → then back to `SmartEditor` with 15k char cap per section
- `parseMarkdownSections` now returns raw text strings instead of running heavy `mdToHtml()` regex — Tiptap StarterKit handles markdown shortcuts natively
- Lazy section mounting with `setInterval` for 65k+ word pastes (removed later when caps proved sufficient)

### Fixed: Quicks persistence (content lost on re-open)
- `save()` was storing JSONContent objects wrapped around strings instead of the actual string content
- `loadEntry()` was passing `{ type: "doc", content: [{ type: "paragraph" }] }` for string docs, losing the text
- **Fix**: store `doc` directly as the raw string, not wrapped in a Tiptap document node

### Fixed: Confirm dialog permission error
- Tauri v2 blocks `window.confirm` unless `dialog:allow-confirm` is in capabilities
- Added permission to `src-tauri/capabilities/default.json`

### Known Issues (Next Session)

1. **Prompt Builder RectifyBar doesn't work with `activeEditorRef`** — the ref captures the last focused editor, which may be null when the bar opens. Fix: fallback to store-level replace across all sections when no editor is focused.

2. **Template application creates duplicate sections** — `updateTemplate` in PromptStore dumps current content to scratchpad and loads new sections, but the document's `template_id` in `meta` gets out of sync with the actual sections.

3. **Scratchpad panel shows old content** — `scratchpadText` in PromptStore is loaded on `loadDocument()` but never re-fetched when switching tabs within the same document.

4. **Canvas tab always shows empty flow** — `canvasFlow` state is local to `FileTab` and never persisted/loaded from the document's `scratchpad_flow_path`.

5. **Outline panel in Prompt Builder shows section titles instead of heading nodes** — the `compiledOutput` string has `SECTION_TITLE:\nvalue` format, not `# Heading`. Outline works but uses section titles as a proxy.

6. **Collection tree doesn't refresh after sidebar rename** — `documentNameOverrides` is used for display but the tree still queries `SELECT id, name FROM documents`, so renamed prompts show old names until manual refresh.

7. **Settings fonts/heading sizes don't re-apply after settings modal re-open** — `useSettingsStore` stores are read on mount but the CSS variables are applied in `App.tsx` effects that only run when `settings.fonts`/`settings.headingSizes` change.

8. **Snippets sidebar doesn't refresh after creating a new snippet** — `LibrarySidebarPanel` loads snippets once on mount and never re-fetches.

9. **`__global__` namespace still shows in snippet mention dropdown for existing DB entries** — filtered in `getNamespaces()` but old rows still exist in the `namespaces` table.

10. **Delete prompt doesn't remove the open tab** — `PromptElements.handleDelete` calls `closeTab` but if the tab doesn't exist in the store it silently fails.

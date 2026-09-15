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

---

## Session Log — 14/09

### Known Issues Audit

Re-verified all 10 "Known Issues (Next Session)" against the code — all 10 are now resolved:

* **Fixed this session:** #1 (RectifyBar now falls back to a store-level `replaceAll()` on `usePromptStore` instead of the never-assigned `window.__quicksStore`; the dead global was removed), #4 (`canvasFlow` moved out of `FileTab` local state into `usePromptStore`, loaded from and debounced-written to `scratchpad_flow_path`, with the `<Canvas>` keyed per tab so it re-seeds), #5 (`OutlinePanel` now parses Tiptap heading nodes and `#`/`##` lines instead of using section titles as a proxy), #7 (`App.tsx` applies the font + heading-size settings as `--font-*` / `--heading-h*` CSS variables; headings consume `--font-heading`).
* **Already fixed:** #2, #3, #6, #8, #9, #10.
* No actionable `TODO` / `FIXME` / `HACK` markers exist anywhere in the source tree.

### Skills UI polish

* Replaced the native `<select>` elements (graph scope, skill group, template, and "from library") with a reusable `components/ui/Select.tsx` that matches the existing custom dropdown (`TemplateSelector`) — portal panel, `bg-surface` / `border-border` / `shadow-lg` / `rounded-xl`, motion fade + chevron rotation, and dismiss on mousedown-outside or Escape.
* Skills now use the `Blocks` lucide icon instead of `Sparkles` (which reads as "generate").

### Graph view — Obsidian-style node graph

* Replaced the hierarchical tree layout with a real node graph: **nodes = skills**, **edges = skills sharing a group** plus **skills sharing a template**.
* Positions come from a deterministic spring-electric layout (`lib/graph/force.ts`) — seeded on a circle by index, no RNG, so the graph is stable across renders. Nodes are drag-to-reposition; double-click a node to open that skill.
* Nodes render as dots (`SkillGraphNode`), sized by degree and tinted per group, with the label beneath. Both handles sit at the node centre so edges run dot-to-dot.
* Scoping to a group now filters the node set and recomputes the graph; `fitView` re-runs on every scope change.
* Deleted the superseded `lib/graph/layout.ts`.

### Ungrouped skills are visible

* `SkillGroupTree` now renders skills as leaves under each group and adds an **Ungrouped** section for skills with no group — previously only groups were listed, so ungrouped skills were invisible.
* Groups auto-expand on first load, and deleting a group now keeps its contents (they fall back to Ungrouped) instead of cascading.

### Snippets moved into the Template tabs

* The Library is now `Skills | Graph` only.
* Snippets moved to the Template view as a tab — `Templates | Snippets` — kept in sync with the Template sidebar through `templateTab` in `useTemplateStore`.
* Extracted `components/library/SnippetList.tsx` and `SnippetsPanel.tsx`; `LibrarySidebarPanel` is now just the skill group tree. The `LibraryTab` type was replaced by `SnippetMode` in `SidebarStore`.

### Feature: Agent Skills in the Library

Skills are portable markdown capabilities (à la `SKILL.md`) that live in the Library, can be grouped, and can be viewed as a graph.

**Goal**

* The Library holds agent skills as markdown files — shareable and portable.
* A skill combines a template + library key/value pairs.
* Skills group into nested parent groups.
* Graph view renders globally, or scoped to a parent group.

**Data model (migration 4)**

* `skill_groups(id, name, parent_id → skill_groups, order_index, meta_json, created_at, updated_at)` — nested, mirrors `collections`.
* `skills(id, name, description, group_id → skill_groups, template_id → templates, values_json, meta_json, created_at, updated_at)`.
* No path columns — the content path is deterministic: `skills/<id>/SKILL.md` (local-first principle).

**Decision — why not `documents.type = 'skill'`**

* `documents.type` has `CHECK(type IN ('quick','prompt'))`; SQLite cannot `ALTER` a CHECK, only rebuild the table.
* A rebuild needs `PRAGMA foreign_keys=OFF` outside a transaction, but `runMigrations()` wraps each migration in `BEGIN … COMMIT` where that pragma is a no-op — and `document_assets` / `comments` / `conversations` reference `document_id`.
* Skills are a distinct artifact anyway (portable `SKILL.md`, group-scoped, shareable), so they get dedicated tables. `collections` was the direct template.

**Files**

* New: `lib/types/skill.ts`, `lib/db/skills.ts` (`skillService` + `skillGroupService`), `services/service.skill.ts`, `lib/skillExport.ts`, `lib/graph/force.ts`, `hooks/store/skillStore.ts`, `components/library/{SkillsPanel,SkillModal,SkillGroupTree,SnippetList,SnippetsPanel}.tsx`, `components/graph/{SkillGraph,SkillGraphNode}.tsx`, `components/ui/Select.tsx`.
* Modified: `lib/db/index.ts` (migration 4), `lib/fs/fsHelpers.ts` + `lib/fs/fs.ts` (`skills/` workspace dir), `components/library/LibraryView.tsx` (`Skills | Graph` sub-tabs), `components/Sidebar/LibSidebar.tsx` (skill tree), `components/template/{TemplateView,TemplateSidebar}.tsx` (`Templates | Snippets` tabs), `components/library/SnippetModal.tsx`, `hooks/store/{templateStore,SidebarStore,skillStore}.ts`, `hooks/store/PromptStore.ts` (canvas flow + `replaceAll`), `components/Prompt/{fileTab,RectifyBar,OutlinePanel}.tsx`, `components/Home/HomeView.tsx`, `hooks/store/quickStore.ts`, `src/App.tsx`, `src/styles/TextEditor.css`.

**Behavior**

* `compileSkill()` resolves `{{key}}` tokens from the skill's own values, then from library snippets — this is the template + key/value "combine".
* `templateToMarkdown()` seeds a skill body from a template's sections.
* Import/export round-trips a `SKILL.md` (YAML frontmatter `name`/`description` + body) through Tauri dialogs.
* Graph scope is `graphScopeId` — `null` for global, or a group id. Edges are group→subgroup, group→skill, and skill→template. Layout is deterministic (`layoutHierarchy`), so no positions are persisted. Read-only React Flow, inherits the app theme.

**Verification**

* `npx tsc --noEmit` clean.
* The 4 open known issues are untouched by this change.

---

## Session Log — 15/09

### Decision: quicks drop the section model, markdown becomes canonical

**Why**

* Sections in quicks only ever bought reordering, and reordering per-section editors (each with its own title input and remount `key`) is more tedious than moving text. Nothing section-scoped was actually used on the quick side — no per-section comments, no template mapping, no `templateSectionId`.
* The `##` paste-splitting silently fragmented pasted markdown into titled boxes that were never asked for — the same class of surprise as the earlier `.trim()` / char-count drift.
* Sections stay for prompts/templates, where they are load-bearing: templates are blueprints, output wraps per section, `templateSectionId` links back, `ReadAndCompile` consumes them. There they become a *derived* view (parsed from `##` on demand) rather than an editing concept.

**Pipeline**

* A quick is now one markdown body. `plain` output became `markdown` (the body verbatim — what you paste into an LLM); `json`/`xml` are derived by splitting the parsed doc on level-2 headings (`deriveSections`), so the LLM-facing formats keep their structure.
* Added `@tiptap/markdown@3.23.4` (version-matched to the installed Tiptap; peer-depends on `@tiptap/core@3.23.4`, backed by `marked`) as the real parser + writer: `contentType: 'markdown'` on create, `editor.getMarkdown()` on update. Verified headlessly that md → doc → md is byte-identical for headings, bold, lists, fenced code and blockquote.
* `hooks/store/quickStore.ts` — `sections: QuickSection[]` → `body: string` + `loadKey` (remount trigger when a different quick is loaded). `QuickSection` and the `JSONContent | string` union are gone.
* `components/ui/SmartTextEditor.tsx` — gained `contentType`, a third `onChange(plain, doc, markdown)` arg, and a `handlePaste` that parses pasted markdown into rich text in markdown mode. Prompt-side callers are unaffected (2-arg handlers ignore the third).
* Quicks persistence is unchanged at the DB level: `documents.sections_json` holds a single body-only section (`id: "body"`, `title: ""`, `value: markdown`). No migration, no CHECK rebuild, `documents.type='quick'` intact — which is what keeps quick → prompt promotion cheap later.

**Files**

* New: `lib/editor/markdown.ts` (`parseMarkdown`, `toMarkdown`, `deriveSections`).
* Deleted: `lib/editor/parseMarkdown.ts` (hand-rolled `mdToHtml` + regex `##` split — superseded; recoverable via git).
* Modified: `hooks/store/quickStore.ts`, `components/Home/HomeView.tsx`, `components/ui/SmartTextEditor.tsx`, `components/Sidebar/QuicksSidebar.tsx`, `package.json`.

**Fixed along the way**

* Find/replace now works in quicks — it was a literal no-op before, because it only touched sections whose `doc` was still a raw string, and every keystroke had already flattened those to plain text.
* Removed the silent 15 000-char truncation of editor content (contradicted the no-silent-data-loss principle). Worth watching whether the single-editor path needs a *visible* cap for very large pastes.
* `quickStore.save()` no longer adds a tab — `HomeView.handleSave` already did, so an explicit save created two.

**Open trade-off**

* Markdown is now the storage format, so a real parser + writer normalizes on write (`*` → `-`, list renumbering, blank-line collapsing). Byte-for-byte fidelity of the pasted text is therefore only guaranteed until the first edit. Accepted as the cost of structural correctness.

**Verification**

* `tsc --noEmit` clean.
* Headless round-trip check: parse → serialize is identity; section derivation returns the expected sections for a two-`##` document.


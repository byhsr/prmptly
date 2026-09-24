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

---

## Session Log — 22/09

### Decision: builder collapses to one markdown body · Home becomes a launcher · Templates + Library merge into "Library"

**Why**

* The builder was still one editor per template section with drag-ordering. Sections only earn their keep as *derived* views (quicks already proved this), so the builder now edits a single markdown body and `##` headings are parsed on demand — the same pipeline quicks use.
* Home was the quicks editor with no entry surface. It is now a launcher whose idle state is a menu (recents, quick actions, new quick). Quicks still open *in* Home, so the "quicks live in Home" rule holds.
* Templates and Library were two rail tabs both holding reusable resources; they are now one **Library** tab (Templates | Snippets | Skills | Graph).

**Pipeline**

* `PromptStore` — `sections` / `filledSections` / `filledSectionDocs` + hand-rolled `compile()` → a single `body: string` + `loadKey` (remount trigger, same as quicks). Persistence reuses the quicks shape: one `sections_json` entry (`id: "body"`). No migration.
* New `lib/editor/outputs.ts` — `buildOutput(body, format)` / `buildOutputs(body)`, lifted out of `quickStore.generate`; quicks and prompts now share one writer. Prompt output format is `markdown` (default) | `json` | `xml`; prompt-side `plain` is gone. The output panel derives on demand (`useMemo`), so nothing serializes per keystroke.
* Builder gained in-place **copy** (markdown→clipboard) and **export** (`.md` via the Tauri save dialog, `lib/exportMarkdown.ts`), styled like the quicks save bar.
* Template selection seeds the body with a `## <section>` scaffold; the previous body is dumped to the scratchpad first (behaviour unchanged).
* `ViewType` → `home | prompt | library`. `LibraryTab = templates | snippets | skills | graph` lives in `skillStore`; `templateStore.templateTab` is gone. One sidebar list per active sub-tab, no in-panel mode toggle.
* Recents = `listDocuments()` (already `updated_at DESC`) — no new tracking table.

**Files**

* New: `lib/editor/outputs.ts`, `lib/exportMarkdown.ts`, `components/Home/HomeMenu.tsx`.
* Deleted: `components/template/TemplateSidebar.tsx` (folded into `components/Sidebar/LibSidebar.tsx`; recoverable via git).
* Modified: `hooks/store/{PromptStore,quickStore,skillStore,templateStore}.ts`, `lib/types/DashTypes.ts`, `components/Prompt/{BuilderPanel,GeneratedPromptPanel,fileTab,RectifyBar}.tsx`, `components/Home/HomeView.tsx`, `components/library/LibraryView.tsx`, `components/template/TemplateView.tsx` (now exports `TemplateForm`), `components/Sidebar/LibSidebar.tsx`, `components/core-components/{SideBars,Workspaces,Tabbar}.tsx`.

**Verification**

* `tsc --noEmit` clean.
* Runtime hand-off (user runs `tauri dev`): launch → quicks menu; new/open quick swaps in the editor; `← quicks` returns. Builder edits as markdown, copy + export work, template selection seeds the body. Library shows all four sub-tabs with a matching sidebar.
* Not yet verified in the running app — the section-record removal (`filledSections` etc.) touches the builder's save path, so a save→reopen round-trip is the thing to check first.

---

## Session Log — 22/09 · ark canvas tab + topbar vault graph

### Decision: embed ark as a Canvas tab · new editable vault graph in the topbar · drop the builder canvas

**Why**

* Ark (sibling project) is a no-build free-form flow designer with nested canvases, groups, stickies/shapes, JSON import/export and an agent bundle. Reimplementing it would be a many-thousand-line port for no behavioural gain, so it is **vendored as-is** and hosted in an iframe.
* The prompt builder's canvas was a per-document React-Flow panel with per-type accent colours (which the single-accent rule rejects) and no nesting. It is superseded by the ark tab, so it comes out of the builder.
* There was no vault-level view of how things relate. A graph where nodes are the vault's entities and edges are user-made connections is the "see things and connect things" surface, opened from the topbar.

**Pipeline**

* **Vendored** `public/ark/` — `index.html`, `css/`, `js/` (8 modules), `fonts/`, `icons/`, `manifest.webmanifest`. Excluded `tools/`, `.git/`, `dist/`, `.smoke/`, `examples/`, and `sw.js`. Only three deviations from upstream: an added `<script src="bridge.js">` in `index.html`, the new `bridge.js`, and `registerServiceWorker()` commented out in `main.js` (sw.js isn't shipped, so it only produced a 404 per boot). Re-copying ark later means re-applying those three.
* **Bridge** (`public/ark/bridge.js`) uses ark's existing public surface only — `FD.app.toJSON()`, `FD.app.importText()`, `FD.bus`, `data-theme`. ark → host on debounced `doc`, host → ark on `ark:load`, plus `ark:ready` (bounded poll on `FD.app.ready`, since `boot()` is async).
* **Storage**: content at `vault/canvases/<id>.json`, metadata in a new `canvases` table (migration 7). `WORKSPACE_DIRS`/`dirs` gained `canvases`; `getCanvasDocPath` is distinct from the older `getCanvasPath` (`documents/<id>/scratchpad.flow.json`).
* **Graph** (migration 8): `graph_nodes(node_id, x, y)` + `graph_edges(id, source_id, target_id, label)`. Nodes are always derived live from `documents`/`templates`/`skills`/`deterministic_assets`, so only edges and positions are user state; node ids are `<kind>:<id>` (`snippet:<scope>:<key>` since snippets have no row id). Edges whose endpoints no longer exist are dropped on read.
* `ViewType` → `home | prompt | library | canvas`. Canvas gets a rail button, a sidebar list, and `CanvasView` (iframe + bridge). The graph is an overlay opened from a `Waypoints` button in the topbar, gated by `isGraphOpen` in `TabStore` and rendered in `AppFlow` beside `SettingsModal`.
* Builder: `canvas` removed from `SubTab`/`SUB_TABS`/`renderPanel`; `PromptStore` lost `canvasFlow`/`updateCanvas`/`debouncedCanvasPersist`; the AI panel no longer receives `canvasContext`.

**Files**

* New: `public/ark/**`, `components/canvas/CanvasView.tsx`, `components/Sidebar/CanvasSidebar.tsx`, `services/service.canvas.ts`, `hooks/store/canvasStore.ts`, `lib/types/canvasDoc.ts`, `lib/types/graph.ts`, `lib/db/graph.ts`, `lib/graph/buildVaultGraph.ts`, `components/graph/{VaultGraph,EntityNode,GraphView}.tsx`.
* Modified: `lib/db/index.ts` (migrations 7 + 8), `lib/fs/fs.ts`, `lib/fs/fsHelpers.ts`, `lib/types/DashTypes.ts`, `components/core-components/{SideBars,Workspaces,Tabbar}.tsx`, `hooks/store/TabStore.ts`, `src/App.tsx`, `components/Prompt/fileTab.tsx`, `hooks/store/PromptStore.ts`.
* Left unused on disk: `components/canvas/{Canvas,CanvasNode,NodePalette,NodePropertiesPanel}.tsx`, `lib/types/canvas.types.ts`.

**Known leftover**

* `createPrompt()` still writes an empty `documents/<id>/scratchpad.flow.json` (nothing reads it now). Left alone deliberately — it's on the prompt-creation path and writes no user data.

**Verification**

* `tsc --noEmit` clean across the app.
* `node --check` passes on both edited ark scripts; all 11 local refs in `public/ark/index.html` exist, and `bridge.js` is confirmed last in load order (after `main.js`, so `FD.app`/`FD.bus` exist when it runs).
* Not verified in the running app: the iframe bridge round-trip (draw → vault file → reopen) and graph edge persistence. Those need a real `tauri dev` session.

---

## Session Log — 22/09 · full width, vault transition, copy anywhere

### Decision: drop the line cap · brand the vault swap · make copying reachable everywhere

**Why**

* The `72ch` measure cap added to `.smart-editor-content` was the only thing keeping quicks and prompts from running full width. It is now removed (the rule contained nothing else). Breathing room stays — the cap was the constraint, not the padding.
* Vault switching reloads the webview, which looked like a bare spinner (and a white frame before that). It should read as one continuous branded moment.
* Copying a prompt was only possible in the output sub-tab, and copying a quick required pressing **Generate** first — even though the markdown is right there in the editor.

**Pipeline**

* `src/styles/TextEditor.css` — removed `.smart-editor-content { max-width: 72ch }`. `SmartEditor` is mounted in exactly two places (`BuilderPanel`, `HomeView`), so nothing else is affected.
* **`VaultTransition`** (new) — logo + accent bloom + indeterminate sweep + label. Used twice: as the `!dbReady` screen (was a spinner), and as an `overlay` when `useVaultStore.switching` is true, which `switchVault`/`createVault` set before reloading. `reopen()` now waits two frames so the overlay is painted before the webview navigates.
* **Boot splash in `index.html`** — an inline `<style>` + `#boot` mark, so even the pre-JS frame of a reload is branded instead of white. `#root:not(:empty) ~ #boot` hides it the moment React renders, and an 8 s inline timer removes it outright so it can never mask the app or an error screen.
* **`OverflowMenu`** (new, `components/ui/`) — a kebab action menu in the app's dropdown grammar (portal, `bg-surface`/`border-border`/`shadow-lg`/`rounded-xl`, motion fade, mousedown-outside + Escape, viewport-clamped, opens upward when low). Extracted as a component rather than a third ad-hoc menu; `ContextMenu` (right-click, `bg-zinc-900`, dismiss-on-mouseleave) was not a fit.
* Builder: keeps the default-visible **copy** + **export .md** row, and gains the kebab → copy as markdown / JSON / XML.
* Quicks: the editor's hover bar gains a direct **copy** (markdown, no Generate needed) and the same kebab. Both use `buildOutput(body, format)` — the existing single writer.

**Files**

* New: `components/ui/OverflowMenu.tsx`, `components/core-components/VaultTransition.tsx`.
* Modified: `src/styles/TextEditor.css`, `index.html`, `hooks/store/VaultStore.ts`, `src/App.tsx`, `components/Prompt/BuilderPanel.tsx`, `components/Home/HomeView.tsx`.

**Verification**

* `tsc --noEmit` clean.
* Vite dev on a spare port: `/`, `/favicon.ico.png`, `/ark/index.html`, `/ark/bridge.js`, `/ark/js/main.js`, `/ark/css/styles.css`, `/src/main.tsx` all 200; the boot splash survives Vite's HTML transform.

**Assumption worth confirming**

* The builder's copy lives in an always-visible action row ("by default"). If it was meant to be hover-revealed like the quicks bar, that is a one-line move into a `FloatingBar`-style wrapper.

---

## Session Log — 22/09 · remove the AI assistant, one action set for quicks and prompts

### Decision: no in-app assistant · copy/export only · subtle borders

**Why**

* The assistant panel was more surface than the workflow needed — copying the prompt out is the job. The builder and quicks now expose the same small action set.
* Autosave already saves, so an explicit **Save** button was ceremony, and **Generate output** only existed to reveal json/xml — which "copy as JSON/XML" does directly.
* The first border fix over-corrected: `#3a3a3a` read as a bright rule on the near-black theme.

**Pipeline**

* **AI assistant removed** from the UI: the Brain button + panel mount in `fileTab`, the AI action + panel mount in `HomeView`, and the **Settings → AI** tab. `components/ai/AIAssistant.tsx` and `components/settings/AI.tsx` stay on disk unused (nothing imports them).
* **Quicks lost its output view entirely.** With Generate gone the markdown/json/xml reader was unreachable, so `output`, `generate`, the `activeTab` reader, save-output and discard all came out of `HomeView`. The bar is now **copy · export · outline · find · ‹copy as…›**, and Ctrl+S is no longer bound there.
* **Export added to quicks** (`exportMarkdownToFile`), matching the builder's `export .md`.
* `BuilderPanel` hardened against the reported bug: root `h-full min-h-0`, the editor `flex-1 min-h-0`, and the action row `sticky bottom-0` on `bg-background`. A pasted prompt taller than the pane can no longer push copy/export out of view — the editor scrolls internally and the row stays put.
* `PromptView`'s wrapper dropped `items-center justify-center` — centring a full-height child is a foot-gun for exactly this overflow case.
* Borders back to subtle: dark `#2a2a2a`, light `#dddddd`, cyberpunk `#1e3a1e`. The **selection** borders (active tab) are `border-primary` = foreground, so they stay clearly visible while `--border` goes quiet again.

**Files**

* Modified: `components/Home/HomeView.tsx`, `components/Prompt/fileTab.tsx`, `components/Prompt/BuilderPanel.tsx`, `components/settings/SettingsView.tsx`, `src/App.css`.

**Verification**

* `tsc --noEmit` clean; grep confirms nothing imports `AIAssistant`/`AI` any more.
* Vite dev: `/` and every changed module (HomeView, BuilderPanel, fileTab, SettingsView) transform with 200.

**Open question**

* Quicks' floating bar only surfaces when the pointer nears the bottom-right corner (its own requested behaviour), so it will still *appear* hidden after a paste. If the bug report meant that bar rather than the builder's row, say so and I'll pin it visible.

---

## Session Log — 22/09 · one floating bar for both editors

### Decision: share the bar instead of re-styling it per surface

**Why**

* The builder's actions were a hardcoded always-visible row; quicks' are a floating bar that appears on approach. Two grammars for the same job, and the row was the thing a tall paste could push out of view.

**Pipeline**

* `FloatingBar` + `BarAction` moved out of `HomeView` into **`components/ui/FloatingBar.tsx`** and used by both editors. The builder's row is gone; copy / export / ‹copy as…› now live in the same fixed-positioned bar as quicks.
* Because the bar is `position: fixed`, editor content can no longer displace it — that removes the push-out class of bug at the root, so the `sticky`/`bg-background` workaround from the previous entry is deleted. The `min-h-0` hardening on the pane stays (correct on its own merits).
* Home menu: dropped the `quicks` heading and the "Start something new…" line — it goes straight to **Quick actions** and **Recents**. Action cards now put the icon and label on one row with the hint beneath.
* Active document tab: `border-primary` (a near-white hairline — read as a stray focus ring) → `border-border`. The selected tab is still obvious from the `bg-surface` fill, the type dot and the label; `--color-primary` remains foreground for *text* states, which is where it looked right.

**Files**

* New: `components/ui/FloatingBar.tsx`.
* Modified: `components/Prompt/BuilderPanel.tsx`, `components/Home/HomeView.tsx`, `components/Home/HomeMenu.tsx`, `components/core-components/Tabbar.tsx`.

**Verification**

* `tsc --noEmit` clean; Vite dev serves `/` and every changed module with 200.

---

## Session Log — 22/09 · canvases reach the menu and the graph

### Decision: canvases are first-class in both vault-wide surfaces

**Why**

* Canvases live in their own `canvases` table, so they were invisible to anything derived from `documents` — the Home menu's recents and the vault graph both silently skipped them.

**Pipeline**

* **Recents** now merges `listDocuments()` with `canvasService.list()` into one `{id, kind, label, updatedAt}` list, sorted by `updatedAt` and capped at 8 — the same shape recents will need if more kinds are added later. Canvas rows get a `Shapes` icon and open into the Canvas tab (select + `setActiveView("canvas")`).
* **Graph**: `GraphEntityKind` gained `canvas`; `buildVaultGraph` pulls `canvasService.list()` and emits `canvas:<id>` nodes. Double-click sets the canvas selection and switches view. No schema change — nodes are still derived live, only edges/positions are stored.
* Quick-action cards: `gap-1` → `gap-2` between the icon/title row and the hint.

**Files**

* Modified: `components/Home/HomeMenu.tsx`, `lib/types/graph.ts`, `lib/graph/buildVaultGraph.ts`, `components/graph/VaultGraph.tsx`.

**Verification**

* `tsc --noEmit` clean; Vite dev serves `/` and every changed module with 200.

---

## Session Log — 22/09 · settings matches the graph overlay

### Decision: one overlay shell for the two full-screen panels

**Why**

* Settings was still the old small undecorated box (no border, square-ish corners, instant appearance, no visible close) while the graph had moved to a bordered panel with a header and a fade. Two looks for the same kind of surface.

**Pipeline**

* `SettingsModal` now uses the graph's shell verbatim: dim `rgba(0,0,0,0.6)` backdrop, `motion.div` fade + `scale 0.99 → 1` over 0.14s, `rounded-xl border border-border`, a header row (`border-b`, title on the left, `X` close on the right, same button styling), Escape to close, and `z-[9998]` so it sits in the same layer as the graph. Size went `720×480` → `min(92vw, 960px) × min(88vh, 680px)`.
* `SettingsView`'s nav was using raw `bg-neutral-800` / `text-accent` / `text-neutral-400` — off-theme hardcoded greys. Switched to tokens (`bg-background text-foreground` when active, `text-muted` otherwise), rounded rows, tighter padding, `shrink-0` on the rail and `min-w-0` on the content.

**Files**

* Modified: `components/settings/SettingsModal.tsx`, `components/settings/SettingsView.tsx`.

**Verification**

* `tsc --noEmit` clean; Vite dev serves `/` and both settings modules with 200.

---

## Session Log — 24/09 · raw markdown mode + inline notes

### Decision: the builder and quicks can be edited as colored markdown source

**Why**

* The builder was WYSIWYG only — the markdown body is a *derived* value (`editor.getMarkdown()`), never shown as editable source. Being able to see and edit the actual markdown is the point of a markdown-first app.

**Pipeline**

* `editorMode: "pretty" | "raw"` lives in `AppSettings` (persisted via `settingsStore.updateSetting`), so one toggle means the same thing on both surfaces and survives a restart. Toggle is an icon button in the FileTab header (`Code` / `Pilcrow`) and a `BarAction` in the quicks floating bar.
* `RawMarkdownEditor` puts a transparent `<textarea>` over a Shiki backdrop. Both layers share one `SKIN` style object — any divergence in font metrics, padding or wrapping shows up as the caret drifting off its own colored text. The textarea auto-grows, so there is no scroll to sync and nothing is clipped.
* Highlighting is **synchronous** (computed in `useMemo`, so the backdrop and caret change in the same paint); `lib/editor/highlighter.ts` holds a lazily-created Shiki singleton, because Shiki's top-level `codeToHtml` builds a new highlighter per call — far too slow per keystroke. Measured warm: ~2ms per 1k chars (1k ≈ 6ms, 10k ≈ 18ms). Below 10k chars it highlights live; above that it waits 180ms for a typing pause and shows plain text meanwhile, so a large paste never makes typing lag. The measured 127ms first call is cold-start only and `GeneratedPromptPanel` now shares the same singleton.

### Decision: notes are `%% note %%`, stripped from every compiled output

**Why**

* Tested `<!-- note -->` and `[//]: # (…)` headlessly through this repo's own Tiptap pipeline: comments get **escaped** to `&lt;!--` and link-ref definitions are **dropped** outright — both silently corrupt or lose the note the moment you switch pretty ↔ raw. `%% … %%` reaches a fixed point, byte-for-byte, block and inline (verified: 2nd and 3rd round-trips identical). It is also Obsidian's convention for the same job.

**Pipeline**

* Notes live inline in the body, so they travel with the document. `lib/editor/notes.ts` handles extract / strip / insert; the regexes are line-scoped (`[^\n]`) so one mistyped `%%` can never swallow the document.
* Stripping happens in one place — `buildOutput` / `buildOutputs` — so it covers the Prompt panel, Copy as markdown/JSON/XML and both exports. `BuilderPanel`/`HomeView` copy handlers now route through `buildOutput(body, "markdown")` instead of copying `body` raw.
* `stripNotes` only removes note spans and the blank lines they leave; no `.trim()` of surrounding content.
* The navigator panel gained a **Notes** group. Clicking a note selects it in the raw textarea (jump *and* ready to edit) or scrolls and flashes it in pretty mode. `+ note` in that group and the `note` floating-bar action both insert `%%  %%` at the caret via `hooks/useAddNote`, which targets whichever editor is live.
* `activeEditorRef` (previously exported from `BuilderPanel`) and the new `activeRawTextareaRef` moved to `lib/editor/activeEditors.ts` so the shared note action can reach both without a circular import.
* `lib/editor/noteDecoration.ts` adds a **view-only** ProseMirror decoration so `%%` notes read as notes in pretty mode. Decorations never reach serialization, so this cannot affect the round-trip — which is exactly why a real node/mark was rejected.

**Files**

* New: `lib/editor/notes.ts`, `lib/editor/highlighter.ts`, `lib/editor/noteDecoration.ts`, `lib/editor/activeEditors.ts`, `components/Prompt/RawMarkdownEditor.tsx`, `hooks/useAddNote.ts`.
* Modified: `lib/editor/outputs.ts`, `lib/config/settings.ts`, `lib/db/appSettings.ts`, `components/Prompt/BuilderPanel.tsx`, `components/Prompt/fileTab.tsx`, `components/Prompt/OutlinePanel.tsx`, `components/Prompt/GeneratedPromptPanel.tsx`, `components/Home/HomeView.tsx`, `components/ui/SmartTextEditor.tsx`, `src/styles/TextEditor.css`.

**Verification**

* `tsc --noEmit` clean; Vite dev (temp port, 1420 left free) serves `/` and every new/changed module with 200; confirmed Tailwind emits `caret-foreground` / `text-transparent` and that `.md-note` is in the served CSS.
* Headless suite (removed after running): extract/strip/insert offsets, notes-only body, lone `%`, idempotence, and the Tiptap round-trip fixed-point proof above — all pass.
* Not yet exercised in the running app — the caret/backdrop alignment and the note navigation are worth a look in `tauri dev`.


# Taste Profile
- Prefers **local-first architecture** — SQLite is the source of truth, cloud sync is optional/posterior, not foundational. Confidence: 0.9
- Uses **files for content, SQLite for metadata** (hybrid storage: prompt JSON, markdown, canvas, attachments on disk; documents, versions, templates, collections in DB). Confidence: 0.9
- Keeps **Rust minimal** — used only for SQLite, filesystem, and native APIs; no Rust AI, no Rust embeddings. Confidence: 0.9
- Places **AI logic in TypeScript**, never in Rust. Confidence: 0.9
- Uses **one SQLite database per workspace** (self-contained workspaces). Confidence: 0.9
- Prefers **deterministic context library over probabilistic RAG** — namespace-based assets (@persona, @project, @rules, @variables) instead of embeddings/vector search. Confidence: 0.9
- Uses **folder-based scratchpad** per document (notes.md, canvas.json, attachments/, metadata.json). Confidence: 0.8
- Structures workspaces as **self-contained directories** with `.prmptly/` internal folder. Confidence: 0.9
- Uses a **single section model** shared across templates, documents, and quicks (serializes into sections_json). Confidence: 0.9
- Distinguishes **quicks from prompts by UI only** — both use the same document schema with different `type` field. Confidence: 0.9

- **Quicks and prompts have strict UI separation on separate sidebars** — quicks (type='quick') belong exclusively in the Home tab's quicks section and must never appear in the prompt sidebar. The prompt sidebar should filter to only `type='prompt'` documents. Any mixing of the two in the same sidebar view is considered a bug. Confidence: 0.9
- Models **templates as blueprints** that are cloned to create documents; templates never change after creation. Confidence: 0.9
- Avoids `vault_id` — removed from schema entirely. Confidence: 0.8
- Uses **crypto.randomUUID()** for ID generation (not `uuid` package, not `nanoid`). Confidence: 0.8
- Uses **domain-driven file organization** in `lib/db/`, `lib/types/`, `services/`, `hooks/store/`, `components/`. Confidence: 0.8
- Prefers **service layer** between DB and components (e.g., `services/service.document.ts`). Confidence: 0.8
- Uses **Zustand stores** for state management. Confidence: 0.8
- Prefers **barrel exports** from domain modules (e.g., `lib/db/index.ts` exports `getDB`). Confidence: 0.7
- Uses **Tauri v2** for desktop shell. Confidence: 0.9
- **Traces end-to-end data flow systematically** before fixing bugs — reads through component → store → service → DB chains to understand the full path before making changes. Confidence: 0.7
- **Preserves unused components on disk** rather than deleting them — keeps code around for future features (e.g., kept `AddContextPanel`, `EnableContext`, `ScopeDocumentsPanel` even after RAG was disabled). Confidence: 0.8
- Runs **`tsc --noEmit` type checking** as part of the workflow to verify code correctness before proceeding. Confidence: 0.8
- Uses **React + TypeScript** for UI. Confidence: 0.9
- **Maintains visual consistency between sidebar panel and main view header** — tab icons/labels in the sidebar should be mirrored in the corresponding main view header. Confidence: 0.5
- Uses **Tiptap** for rich text editors. Confidence: 0.9
- Prefers **icon buttons with hover tooltips** over text labels for compact UI tab bars — uses lucide-react icons with a `group-hover:opacity-100` tooltip span positioned below the icon. Confidence: 0.7

- **Requires consistent custom CSS tooltip pattern across all UI, replacing native HTML `title` attributes** — all tooltips must use the same styled `<span>` approach (absolute positioned, `group-hover:opacity-100`, `bg-surface border border-border text-muted`, small text) rather than native `title` attributes. Explicitly mandates: "use consistent tooltip everywhere the one thats used for scratchpad, canvas etc." Applies to all icon buttons, action buttons, toggle buttons, and sidebar items throughout the entire application. Confidence: 0.8
- Prefers **spring-based micro-interactions on interactive UI elements** — uses `motion.button` with `whileTap={{ scale: 0.88 }}` and spring transitions (type: spring, stiffness: 500, damping: 20) for a smooth tactile feel on buttons, toggles, and tab icons. Confidence: 0.6
- Prefers **dedicated top-level tab per distinct feature** rather than burying tools inside other panels — each major tool (builder, scratchpad, canvas/agent builder, prompt) gets its own visible tab with a unique icon. Confidence: 0.7
- Uses **SQLite via Tauri plugin** (not better-sqlite3 or sql.js). Confidence: 0.9

- Prefers **keyboard shortcuts for common actions** — explicitly requested Ctrl+S for save/update operations, applied consistently across all relevant views (SnippetModal, FileTab/prompt builder, HomeView). Confidence: 0.6

- Prefers **idempotent save semantics** — Ctrl+S should update the existing document in-place, not create a duplicate. The first save creates the document, subsequent saves update it using the stored document ID. Confidence: 0.8

- Prefers **autosave after initial manual save** — once a document has been saved manually for the first time, debounced autosave (e.g., 3 seconds after last edit) should automatically persist changes going forward. Confidence: 0.7

- Prefers **fixed-width tabs with truncated labels** — open tabs in the tabbar should have a constrained max-width with text truncation/ellipsis rather than stretching to fit the full label text. Confidence: 0.7

- **Removes transitional/experimental UI elements when a feature is finalized** — considers cleaning up leftover UI scaffolding (e.g., an icon pill in the sidebar) as the last step before marking a feature "done". Does not leave behind feature-toggle-style visual cruft. Confidence: 0.5

- **Prefers minimal sidebar UI without category label headers** — sidebar panels should not display text labels like "Prompts", "Snippets", "Templates" as section headers; instead, keep only compact create/action buttons. Sidebar should be streamlined and uncluttered. Confidence: 0.7

- **Prefers inline content resolution over placeholder chips in editors** — when selecting a mention/snippet from a suggestion popup, resolve the content immediately and insert the actual text at cursor position, rather than inserting a pending chip/placeholder node that resolves asynchronously. Confidence: 0.9

- **Prefers content excerpts with truncation in suggestion/mention dropdowns** — show a truncated preview (e.g., 120 chars) of the content beneath each item label so users can identify what they're selecting at a glance. Confidence: 0.7

- **Prefers both Enter and Tab to confirm selections in suggestion popovers** — Tab key (alongside Enter) should populate/confirm the selected item, not just move focus. Confidence: 0.7

- **Omits backend/source implementation labels from user-facing UI** — labels like "deterministic" or "rag" that describe the internal source mechanism should not appear in menus, dropdowns, or any UI the user sees. Confidence: 0.6

- **Deletes the trigger syntax when inserting resolved content from mention popups** — when a user selects a mention/snippet from a suggestion list, the entire `@namespace:key` text (including the `@` symbol) must be removed from the document before inserting the resolved content, leaving no trigger syntax behind. Confidence: 0.8

- **Filters out implicit/internal synthetic scopes from user-facing dropdowns** — synthetic namespaces like `__global__` that are internal defaults (not user-created) should be hidden from namespace/scope selection menus and never shown as selectable options. Confidence: 0.7

- **Prefers flat key-value snippet model over namespaced/scoped snippets** — explicitly prefers simple key-value pairs for snippets (just "key" and "value" fields) rather than a hierarchical namespace:key model with scopes. Considers scopes unnecessary complexity. Confidence: 0.8

- **Prioritizes frontend simplification over backend data purity** — willing to remove features from the UI (scope/namespace fields, scope display in sidebar) even if the database schema still stores the legacy data. Pragmatic approach: "you dont have to do it from the db just remove it from the front." Confidence: 0.6

- **Expects live markdown/rich-text conversion parity between typing and pasting** — markdown syntax (e.g., `#` for headings) should convert to rich text in real-time as the user types, not only when content is pasted. The same formatting rules must apply to both input paths. Confidence: 0.7

- **Expects rich text formatting to be visually apparent immediately** — structural formatting changes (e.g., creating an h1/h2/h3 node via `# ` shortcut) must come with corresponding CSS styling so the user can see the effect. Without visible typographic differentiation (font-size, weight, margin), the formatting feature is considered broken/non-functional from the user's perspective — the node existing in the DOM is not enough. Applies to all rich text formatting (headings, lists, blockquotes, etc.). Confidence: 0.8

- **Shows content analytics (char count, word count, token estimate) as a subtle footer bar in editor views** — wants quantitative writing metrics visible at a glance, especially token estimates relevant to LLM usage. Confidence: 0.7

- **Prefers ultra-compact styling for secondary/ambient metadata** — secondary info like stats bars should use minimum visual weight (`text-[10px] font-mono text-muted`, thin border separator) so it's available without competing with primary content. Confidence: 0.6

- **Token-aware — expects token estimates alongside raw char/word counts** — token estimation matters for an LLM-focused workflow; wants approximate token counts to manage context windows and budgets. Confidence: 0.7

- **Prefers full-height editor layouts with internal overflow scrolling** — editors should fill the available vertical space (flex-1, h-full) and scroll their content internally rather than being constrained to a fixed max-height. Content analytics bars stay pinned outside the scroll area (shrink-0 below it). Confidence: 0.7

- **Prefers full-width (edge-to-edge) layouts over centered/max-width-constrained layouts** — explicitly removes `max-w-4xl mx-auto` style constraints in favor of `w-full` for UI panels and editor views. Does not want content artificially centered or constrained horizontally. Confidence: 0.7

- **Prefers stats bar visibility to derive from actual computed data, not state flags** — the visibility of the content analytics bar should react to the actual derived value (e.g., `allText.length > 0`) rather than a component state variable (e.g., `!output && allText`). Wants the bar to show/hide in real-time based on the actual content state, not a stale or indirectly related flag. Confidence: 0.7

- **Prefers live-editable document name in the file tab header** — the document name displayed in the tab header (FileTab top bar) should be an editable input bound to component state (`value`/`onChange`), not a static label. Editing the name should persist to the database and synchronize the tabbar label immediately (on blur or Enter key). The name shown must always correlate to the opened file. Confidence: 0.8

- **Expects CRUD operations (rename, delete) accessible via right-click context menus on sidebar tree items** — sidebar document/prompt items should support right-click context menus with "Rename" (inline editable in the sidebar — no popup dialog) and "Delete" (confirm + delete from DB) actions. Applies to both quicks and prompts in the sidebar. Confidence: 0.8

- **Prefers inline sidebar renaming over popup dialogs** — clicking "Rename" in a context menu should directly make the filename editable in-place in the sidebar tree (swap the `<span>` for an `<input>`), never use `window.prompt()` or any modal dialog. Should auto-focus, select all text, commit on Enter/blur (with save), and cancel on Escape. Confidence: 0.8

- **Expects the sidebar tree to re-fetch/refresh after CRUD mutations** — after renaming or deleting a document via context menu, the sidebar tree should reload (via a `onRefreshTree` callback threaded through the component chain) rather than relying on optimistic local state updates alone. Confidence: 0.7

- **Prefers a single persistence path with no duplicate autosave logic** — explicitly requires "no duplicate persistence logic" and a "single source of truth" for saving. There should be exactly one debounced autosave mechanism (e.g., the store's internal debounce), not multiple competing timers in different components. Confidence: 0.8

- **Deletion must comprehensively remove all traces** — deleting a document should remove the database entry, associated files from disk, close any open tab, and update the sidebar tree in one operation. Leaves no orphaned state anywhere in the application. Confidence: 0.8

- **Prefers direct Zustand store mutations for synchronizing UI labels over relying on tree refresh** — tab labels, sidebar names, and document titles should stay in sync by directly mutating the store state (e.g., `useTabViewStore.setState`) rather than requiring a full tree refresh. Follows the "no manual refresh required" principle for data already available client-side. Confidence: 0.7

- **Expects all document name surfaces (sidebar tree item, file tab header, and tabbar label) to stay synchronized bidirectionally** — renaming from any surface must immediately reflect on all other surfaces. Treats any drift between these three surfaces as a bug. Confidence: 0.6

- **Sidebar items should be click-to-open in the workspace** — clicking a document/quick in the sidebar should open it as a tab in the workspace area (via `addTab`), not just select it in the sidebar. Left-click equals "open for editing". Confidence: 0.8

- **Smart display name fallback for sidebar documents** — sidebar document labels should derive from: (1) user-assigned name if set and non-empty, (2) first-line excerpt from document content (truncated to ~60 chars), (3) "Untitled" as final fallback. Never shows an empty/blank label. Confidence: 0.7

- **Quicks open in the home/quicks view, not the prompt builder** — clicking a quick document in the sidebar should load it into the quicks editing store and switch the main application view to "home". It must NOT open as a tab in the prompt builder workspace. Quicks are edited in-place in the dedicated quicks/home view, not as separate prompt builder tabs. Confidence: 0.9

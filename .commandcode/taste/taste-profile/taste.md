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
- Prefers **spring-based micro-interactions on interactive UI elements** — uses `motion.button` with `whileTap={{ scale: 0.88 }}` and spring transitions (type: spring, stiffness: 500, damping: 20) for a smooth tactile feel on buttons, toggles, and tab icons. Confidence: 0.6
- Prefers **dedicated top-level tab per distinct feature** rather than burying tools inside other panels — each major tool (builder, scratchpad, canvas/agent builder, prompt) gets its own visible tab with a unique icon. Confidence: 0.7
- Uses **SQLite via Tauri plugin** (not better-sqlite3 or sql.js). Confidence: 0.9

- Prefers **keyboard shortcuts for common actions** — explicitly requested Ctrl+S for save/update operations, applied consistently across all relevant views (SnippetModal, FileTab/prompt builder, HomeView). Confidence: 0.6

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

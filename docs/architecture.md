# Architecture notes

Internal notes on how the app is laid out. Moved here from the README when that became user-facing.

## Views

```
ActiveView = "home" | "prompt" | "template" | "library"
```

Sidebar and workspace both hold this, but depending on the parent they show different things:

- `sidebar` — per-view lists (prompt list, library list, templates, etc.)
- `workspace` — the active view's content (active prompt handles fileTabs, create templates, manage library, etc.)

## Components

### Core

- `Dash` — holds the sidebar and the workspaces
- `Onboard` — the first thing a new user sees; picks the base folder
- `Sidebar` — the main sidebar, dispatches to the different active sidebars
- `Workspaces` — the main window holding the active view (prompt, quicks, library, template)
- `Tabbar.tsx` — top bar: tabs, window controls, logo
- `Workspaces.tsx` — the main window that holds the active view

### Home

- quicks and everything under them

### Library

- all the library components

### Prompt

- `BuilderPanel`, `fileTab`, `GeneratedPromptPanel`, `PromptElements` (the DnD rows and sections), `templateSelector`

### Settings

- `SettingsModal` — the core settings panel, rendered on top of everything else
- `SettingsView` — the actual settings view and its panels
- Panels: AI, About, Appearance, Editor (markdown formatting and styles), General, Vaults

### Sidebar

- different sidebar views based on `activeView`: `LibSidebar`, `PromptSidebar`, `SidebarElements` (common items)

### Template

- `TemplateSidebar`
- `TemplateView`

## Hooks

- `useToast`
- `Store` — Zustand stores

## lib

### Client

- `parseMarkdown`
- `TextEditorFuncs`

### Config

- `settings.ts` — controls settings

### DB

- schemas, db init, migrations

### fs

- all the filesystem helpers and functions

### Types

TypeScript types — `AppTypes` (prmptly config: model, theme, etc.), `DashTypes` (`activeView`), `Library` (snippets and other library types).

## Prompt panel pieces

- `builder-panel.tsx`
- `fileTab.tsx` — the main prompt panel, holding builder, scratchpad and `GeneratedPromptPanel` (the result: markdown, XML, JSON)
- `sidebar.tsx`

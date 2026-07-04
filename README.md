# prmptly
---
AcitveView = "home" | "prompt" | "template" | "library" 
sidebar and workspace holds this, but depending on the parent they both have different views, 
sidebar : ActiveView // like promptList, library list, templates etc 
workspace : ActiveView // like activePrompt handles fileTabs, create Templates, manage library etc 

## Components
### Core Components of the project like sidebar, topbar(tabbar),
- Dash ( holds sidebar and workspaces)
- Onboard (the first component user's see when they start the app - choose base folder etc )
- Sidebar - Main Sidebar handles all different active sidebars (Lib)
- Workspaces - Main Workspaces handles all the different active Workspaces activeView 
- Tabbar.tsx // top bar controls, shows tabs, window controls, logo
- Workspaces.tsx // the main window that holds the active view - prompt, quicks, library , template etc

### Home 
- quicks and all 

### Library - all the library components 
### Prompt 
- BuilderPanel, fileTab, GeneratedPromptPanel, PromptElements (the Dnd rows and sections), templateSelector

### settings 
- SettingsModal( the core settings panel that handles popup on top of every other element )
- settingsView the actuall settings view differnet settings and panels etc 
- respective Panels AI, About, Apperance, Editor (change Markdown formattings and styles ), Valuts etc 

### Sidebar 
- different sidebar views based on activeView LibSidebar  , PromptSidebar , SidebarElements (common used items)

### Template 
- TemplateSidebar
- TemplateView


-------

## Hooks
- useToast 
- Store // Zustand store 


-------

## lib 
### Client
- parseMarkdown 
- TextEditorFuncs

### Config
- settings.ts ( control settings )

### DB 
- different schemas and db init , migration etc 

### fs ( all the file system helpers and functions)
### Types TypeScript Types ( AppTypes (prmptly config like has model theme etc ), DashTypes (activeView), Lbirary ( library types like snippets)) * can make a single file *






- builder-panel.tsx
- fileTab.tsx // the main prompt panel - which holds builder , scratchpad and GeneratedPromptPanel ( essentially, result -  Markdown, XML, JSON)
- sidebar.tsx 



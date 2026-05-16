// store/libraryStore.ts
import { create } from "zustand"
import { Snippet } from "@/lib/types/library"
import { LibraryTab } from "@/components/library/LibraryView"
import { Scope } from "@/components/library/AddContextPanel"

export const snippetId = (snippet: Snippet) =>
  snippet.scope
    ? `${snippet.scope}:${snippet.key}`
    : snippet.key

type LibraryStore = {
  // snippet selection
  selectedSnippetId: string | null
  selectSnippet: (id: string) => void
  clearSelection: () => void
  selectedSnippet: () => Snippet | null

  // creation mode / active tab
  activeMode: LibraryTab | null
  setActiveMode: (type: LibraryTab | null) => void

  // snippet cache
  snippets: Snippet[]
  setSnippets: (snippets: Snippet[]) => void
  removeSnippet: (id: string) => void
  updateSnippet: (id: string, updated: Partial<Snippet>) => void

  // scope state
  selectedScopeId: string | null
  selectScope: (id: string | null) => void

  scopes: Scope[]
  setScopes: (scopes: Scope[]) => void

  // add-context form
  addContextScope: string
  addContextContent: string
  addContextFileName: string | null
  setAddContextScope: (scope: string) => void
  setAddContextContent: (content: string, fileName?: string | null) => void
  resetAddContext: () => void
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  // snippet selection
  selectedSnippetId: null,

  selectSnippet: (id) =>
    set({
      selectedSnippetId: id,
      activeMode: null,
    }),

  clearSelection: () =>
    set({ selectedSnippetId: null }),

  selectedSnippet: () => {
    const { snippets, selectedSnippetId } = get()
    return snippets.find((s) => snippetId(s) === selectedSnippetId) ?? null
  },

  // creation mode / active tab
  activeMode: null,

  setActiveMode: (type) =>
  set({
    activeMode: type,
    selectedSnippetId: type ? null : get().selectedSnippetId,
    selectedScopeId: type === "context" ? null : get().selectedScopeId,
  }),

  // snippets
  snippets: [],
  setSnippets: (snippets) => set({ snippets }),

  removeSnippet: (id) =>
    set((state) => ({
      snippets: state.snippets.filter((s) => snippetId(s) !== id),
      selectedSnippetId: state.selectedSnippetId === id ? null : state.selectedSnippetId,
    })),

  updateSnippet: (id, updated) =>
    set((state) => {
      const nextId =
        updated.scope && updated.key
          ? `${updated.scope}:${updated.key}`
          : updated.key ?? id

      return {
        snippets: state.snippets.map((s) =>
          snippetId(s) === id ? { ...s, ...updated } : s
        ),
        selectedSnippetId: state.selectedSnippetId === id ? nextId : state.selectedSnippetId,
      }
    }),

  // scopes
  selectedScopeId: null,
  selectScope: (id) => set({ selectedScopeId: id }),

  scopes: [],
  setScopes: (scopes) => set({ scopes }),

  // add-context form
  addContextScope: "",
  addContextContent: "",
  addContextFileName: null,

  setAddContextScope: (scope) => set({ addContextScope: scope }),

  setAddContextContent: (content, fileName = null) =>
    set({ addContextContent: content, addContextFileName: fileName }),

  resetAddContext: () =>
    set({ addContextScope: "", addContextContent: "", addContextFileName: null }),
}))


type Notification = {
  id: string
  message: string
  error?: boolean
}

type NotificationStore = {
  notifications: Notification[]
  notify: (message: string, error?: boolean) => void
  dismiss: (id: string) => void
}

export const useNotifications = create<NotificationStore>((set) => ({
  notifications: [],

  notify: (message, error = false) => {
    const id = crypto.randomUUID()
    set((s) => ({
      notifications: [...s.notifications, { id, message, error }]
    }))
    setTimeout(() => {
      set((s) => ({
        notifications: s.notifications.filter((n) => n.id !== id)
      }))
    }, 4000)
  },

  dismiss: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id)
    })),
}))
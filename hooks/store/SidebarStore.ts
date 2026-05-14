// store/libraryStore.ts
import { create } from "zustand"
import { Snippet } from "@/lib/types/library"
import { LibraryTab } from "@/components/library/LibraryView"
import { Scope } from "@/components/library/AddContextPanel"

type LibraryStore = {
  // snippet selection
  selectedSnippetId: string | null
  selectSnippet: (id: string) => void
  clearSelection: () => void
  selectedSnippet: () => Snippet | null

  // creation mode
  isCreating: LibraryTab | null
  setCreating: (type: LibraryTab | null) => void

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
  setAddContextContent: (
    content: string,
    fileName?: string | null
  ) => void

  resetAddContext: () => void
}

export const snippetId = (snippet: Snippet) =>
  snippet.scope
    ? `${snippet.scope}:${snippet.key}`
    : snippet.key

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  // selection
  selectedSnippetId: null,

  selectSnippet: (id) =>
    set({
      selectedSnippetId: id,
      isCreating: null,
    }),

  clearSelection: () =>
    set({
      selectedSnippetId: null,
    }),

  selectedSnippet: () => {
    const { snippets, selectedSnippetId } = get()

    return (
      snippets.find(
        (snippet) => snippetId(snippet) === selectedSnippetId
      ) ?? null
    )
  },

  // creation mode
  isCreating: null,

  setCreating: (type) =>
    set({
      isCreating: type,
      selectedSnippetId: type
        ? null
        : get().selectedSnippetId,
    }),

  // snippets
  snippets: [],

  setSnippets: (snippets) =>
    set({
      snippets,
    }),

  removeSnippet: (id) =>
    set((state) => ({
      snippets: state.snippets.filter(
        (snippet) => snippetId(snippet) !== id
      ),

      selectedSnippetId:
        state.selectedSnippetId === id
          ? null
          : state.selectedSnippetId,
    })),

  updateSnippet: (id, updated) =>
    set((state) => {
      const nextId =
        updated.scope && updated.key
          ? `${updated.scope}:${updated.key}`
          : updated.key ?? id

      return {
        snippets: state.snippets.map((snippet) =>
          snippetId(snippet) === id
            ? { ...snippet, ...updated }
            : snippet
        ),

        selectedSnippetId:
          state.selectedSnippetId === id
            ? nextId
            : state.selectedSnippetId,
      }
    }),

  // scopes
  selectedScopeId: null,
  
  selectScope: (id) =>
    set({
      selectedScopeId: id,
    }),

  scopes: [],

  setScopes: (scopes) =>
    set({
      scopes,
    }),
 
  // add-context form
  addContextScope: "",
  addContextContent: "",
  addContextFileName: null,

  setAddContextScope: (scope) =>
    set({
      addContextScope: scope,
    }),

  setAddContextContent: (
    content,
    fileName = null
  ) =>
    set({
      addContextContent: content,
      addContextFileName: fileName,
    }),

  resetAddContext: () =>
    set({
      addContextScope: "",
      addContextContent: "",
      addContextFileName: null,
    }),
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
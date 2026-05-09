// store/libraryStore.ts
import { create } from "zustand"
import {Snippet} from "@/lib/types/library"
import { LibraryTab } from "@/components/library/LibraryView"

type LibraryStore = {
  // selection
  selectedSnippetId: string | null
  selectSnippet: (id: string) => void
  clearSelection: () => void

  // creation mode
  isCreating: LibraryTab | null
  setCreating: (type: LibraryTab | null) => void

  // local cache of snippets (fetched from DB)
  snippets: Snippet[]
  setSnippets: (snippets: Snippet[]) => void
  removeSnippet: (id: string) => void
  updateSnippet: (id: string, updated: Partial<Snippet>) => void
  // derived
  selectedSnippet: () => Snippet | null
}
export const snippetId = (s: Snippet) => s.scope ? `${s.scope}:${s.key}` : s.key
export const useLibraryStore = create<LibraryStore>((set, get) => ({
  selectedSnippetId: null,
  selectSnippet: (id) => set({ selectedSnippetId: id, isCreating: null }),
  clearSelection: () => set({ selectedSnippetId: null }),

  isCreating: null,
  setCreating: (type) => set({ isCreating: type, selectedSnippetId: type ? null : get().selectedSnippetId }),

  snippets: [],
  setSnippets: (snippets) => set({ snippets }),
  removeSnippet: (id) => set((s) => ({
  snippets: s.snippets.filter(x => snippetId(x) !== id),
  selectedSnippetId: s.selectedSnippetId === id ? null : s.selectedSnippetId,
})),
updateSnippet: (id, updated) => set((s) => {
  const newId = updated.scope ? `${updated.scope}:${updated.key}` : updated.key
  return {
    snippets: s.snippets.map(x => snippetId(x) === id ? { ...x, ...updated } : x),
    selectedSnippetId: s.selectedSnippetId === id ? newId : s.selectedSnippetId,
  }
}),

 selectedSnippet: () => {
  const { snippets, selectedSnippetId } = get()
  return snippets.find(x => snippetId(x) === selectedSnippetId) ?? null
}
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
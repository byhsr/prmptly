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
  upsertSnippet: (snippet: Snippet) => void
  removeSnippet: (id: string) => void

  // derived
  selectedSnippet: () => Snippet | null
}

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  selectedSnippetId: null,
  selectSnippet: (id) => set({ selectedSnippetId: id, isCreating: null }),
  clearSelection: () => set({ selectedSnippetId: null }),

  isCreating: null,
  setCreating: (type) => set({ isCreating: type, selectedSnippetId: type ? null : get().selectedSnippetId }),

  snippets: [],
  setSnippets: (snippets) => set({ snippets }),
  upsertSnippet: (snippet) => set((s) => {
    const exists = s.snippets.find(x => x.id === snippet.id)
    return {
      snippets: exists
        ? s.snippets.map(x => x.id === snippet.id ? snippet : x)
        : [...s.snippets, snippet]
    }
  }),
  removeSnippet: (id) => set((s) => ({
    snippets: s.snippets.filter(x => x.id !== id),
    selectedSnippetId: s.selectedSnippetId === id ? null : s.selectedSnippetId,
  })),

  selectedSnippet: () => {
    const { snippets, selectedSnippetId } = get()
    return snippets.find(x => x.id === selectedSnippetId) ?? null
  }
}))
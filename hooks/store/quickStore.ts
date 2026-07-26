import { create } from "zustand"
import { JSONContent } from "@tiptap/core"
import { nodeToPlain, docToCleanJson, nodeToXml } from "@/lib/client/textEditorFuncs"
import {parseMarkdownSections} from "@/lib/editor/parseMarkdown"

export interface QuickSection {
  id: string
  title: string
  doc: JSONContent | string
}

export interface QuickEntry {
  id: string
  name: string
  sections: QuickSection[]
  output: { plain: string; json: string; xml: string } | null
  createdAt: number
}

interface QuicksStore {
  sections: QuickSection[]
  output: { plain: string; json: string; xml: string } | null
  name: string
  savedDocId: string | null
  hasContent: boolean

  setSections: (sections: QuickSection[]) => void
  updateSection: (id: string, doc: JSONContent) => void
  updateSectionTitle: (id: string, title: string) => void
  loadFromPaste: (raw: string) => void
  generate: () => void
  loadEntry: (entry: QuickEntry) => void
  save: () => Promise<string | null>
  reset: () => void
}

function generateName(plainText: string): string {
  return (
    plainText.replace(/@\w+/g, "").trim().split(/\s+/).slice(0, 5).join(" ") ||
    "Untitled Quick"
  )
}

export const useQuicksStore = create<QuicksStore>((set, get) => ({
  sections: [],
  output: null,
  name: "",
  savedDocId: null,
  hasContent: false,

  setSections: (sections) => set({ sections }),

  updateSection: (id, doc) =>
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, doc } : sec)),
      hasContent: true,
    })),
  updateSectionTitle: (id, title) =>
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, title } : sec)),
      hasContent: true,
    })),

  loadFromPaste: (raw) => set({ sections: parseMarkdownSections(raw), output: null, hasContent: true }),

  generate: () => {
    const { sections, save } = get()
    if (!sections.length) return

    const plain = sections
      .map((s) => (s.title ? `${s.title}:\n${typeof s.doc === "string" ? s.doc : nodeToPlain(s.doc)}` : typeof s.doc === "string" ? s.doc : nodeToPlain(s.doc)))
      .join("\n\n")

    const json = JSON.stringify(
      sections.map((s) => ({ title: s.title || null, content: typeof s.doc === "string" ? s.doc : docToCleanJson(s.doc) })),
      null,
      2
    )

    const xml = sections
      .map((s) => (s.title ? `<${s.title}>\n${typeof s.doc === "string" ? s.doc : nodeToXml(s.doc, 1)}\n</${s.title}>` : typeof s.doc === "string" ? s.doc : nodeToXml(s.doc, 0)))
      .join("\n")

    set({ output: { plain, json, xml }, name: generateName(plain), hasContent: true })
    save()
  },

  save: async () => {
    const { sections, savedDocId, name } = get()
    const { createDocument, updateDocument } = await import("@/lib/db/document")
    const docName = name || sections[0]?.title || "Untitled Quick"
    const sectionsData = sections.map((s, i) => ({
      id: s.id,
      title: s.title,
      order: i,
      value: typeof s.doc === "string" ? s.doc : nodeToPlain(s.doc),
      doc: typeof s.doc === "string" ? { type: "doc", content: [{ type: "paragraph" }] } as any : s.doc,
    }))

    try {
      if (savedDocId) {
        await updateDocument(savedDocId, { name: docName, sections: sectionsData })
        return savedDocId
      }
      const doc = await createDocument({ type: "quick", name: docName, sections: sectionsData, meta: {} })
      set({ savedDocId: doc.id, name: docName })
      const { useTabViewStore } = await import("@/hooks/store/TabStore")
      useTabViewStore.getState().addTab({ id: doc.id, label: docName, type: "prompt" })
      // Signal sidebar to refresh
      window.dispatchEvent(new CustomEvent("quick-saved"))
      return doc.id
    } catch {
      return null
    }
  },

  loadEntry: (entry) => set({ sections: entry.sections, output: entry.output, name: entry.name }),

  reset: () => set({ sections: [], output: null, name: "", savedDocId: null }),
}))

// ── Store-level debounced autosave ────────────────────────────────────────────

let quickPersistTimer: ReturnType<typeof setTimeout> | null = null

useQuicksStore.subscribe((state) => {
  if (quickPersistTimer) clearTimeout(quickPersistTimer)
  if (!state.hasContent || !state.sections.length) return
  quickPersistTimer = setTimeout(() => {
    const s = useQuicksStore.getState()
    if (s.hasContent && s.sections.length > 0) {
      s.save()
    }
  }, 2000)
})

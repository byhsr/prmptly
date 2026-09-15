import { create } from "zustand"
import type { JSONContent } from "@tiptap/react"
import { docToCleanJson, nodeToXml } from "@/lib/client/textEditorFuncs"
import { deriveSections, parseMarkdown } from "@/lib/editor/markdown"

export interface QuickOutput {
  markdown: string
  json: string
  xml: string
}

export interface QuickEntry {
  id: string
  name: string
  body: string
  output: QuickOutput | null
  createdAt: number
}

interface QuicksStore {
  body: string
  output: QuickOutput | null
  name: string
  savedDocId: string | null
  hasContent: boolean
  loadKey: number

  setBody: (body: string) => void
  loadFromPaste: (raw: string) => void
  generate: () => void
  loadEntry: (entry: QuickEntry) => void
  save: () => Promise<string | null>
  reset: () => void
}

function generateName(markdown: string): string {
  const cleaned = markdown.replace(/^#{1,6}\s+/gm, "").replace(/@\w+/g, "").trim()
  return cleaned.split(/\s+/).slice(0, 5).join(" ") || "Untitled Quick"
}

function asDoc(nodes: JSONContent[]): JSONContent {
  return { type: "doc", content: nodes }
}

export const useQuicksStore = create<QuicksStore>((set, get) => ({
  body: "",
  output: null,
  name: "",
  savedDocId: null,
  hasContent: false,
  loadKey: 0,

  setBody: (body) => set({ body, hasContent: true }),

  loadFromPaste: (raw) =>
    set((s) => ({ body: raw, output: null, hasContent: true, loadKey: s.loadKey + 1 })),

  loadEntry: (entry) =>
    set((s) => ({
      body: entry.body,
      output: entry.output,
      name: entry.name,
      savedDocId: entry.id,
      hasContent: true,
      loadKey: s.loadKey + 1,
    })),

  generate: () => {
    const { body, save } = get()
    if (!body.trim()) return

    const sections = deriveSections(parseMarkdown(body))

    const json = JSON.stringify(
      sections.map((s) => ({
        title: s.title || null,
        content: docToCleanJson(asDoc(s.nodes)),
      })),
      null,
      2
    )

    const xml = sections
      .map((s) => {
        const inner = nodeToXml(asDoc(s.nodes), s.title ? 1 : 0)
        return s.title ? `<${s.title}>\n${inner}\n</${s.title}>` : inner
      })
      .join("\n")

    set({ output: { markdown: body, json, xml }, name: generateName(body), hasContent: true })
    save()
  },

  save: async () => {
    const { body, savedDocId, name } = get()
    const { createDocument, updateDocument } = await import("@/lib/db/document")
    const docName = name || generateName(body)
    const sections = [{ id: "body", title: "", order: 0, value: body }]

    try {
      if (savedDocId) {
        await updateDocument(savedDocId, { name: docName, sections })
        return savedDocId
      }
      const doc = await createDocument({ type: "quick", name: docName, sections, meta: {} })
      set({ savedDocId: doc.id, name: docName })
      window.dispatchEvent(new CustomEvent("quick-saved"))
      return doc.id
    } catch {
      return null
    }
  },

  reset: () =>
    set((s) => ({ body: "", output: null, name: "", savedDocId: null, loadKey: s.loadKey + 1 })),
}))

// ── Store-level debounced autosave ────────────────────────────────────────────

let quickPersistTimer: ReturnType<typeof setTimeout> | null = null

useQuicksStore.subscribe((state) => {
  if (quickPersistTimer) clearTimeout(quickPersistTimer)
  if (!state.hasContent || !state.body) return
  quickPersistTimer = setTimeout(() => {
    const s = useQuicksStore.getState()
    if (s.hasContent && s.body) {
      s.save()
    }
  }, 2000)
})

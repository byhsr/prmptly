import { create } from "zustand"
import { JSONContent } from "@tiptap/core"
import { nodeToPlain, docToCleanJson, nodeToXml } from "@/lib/client/textEditorFuncs"


export interface QuickEntry {
  id: string
  name: string
  doc: JSONContent
  output: {
    plain: string
    json: string
    xml: string
  }
  createdAt: number
}

interface QuicksStore {
  doc: JSONContent | null
  output: { plain: string; json: string; xml: string } | null
  name: string

  setDoc: (doc: JSONContent) => void
  generate: () => void
  loadEntry: (entry: QuickEntry) => void
  reset: () => void
}

function generateName(plainText: string): string {
  return (
    plainText
      .replace(/@\w+/g, "")
      .trim()
      .split(/\s+/)
      .slice(0, 5)
      .join(" ") || "Untitled Quick"
  )
}

export const useQuicksStore = create<QuicksStore>((set, get) => ({
  doc: null,
  output: null,
  name: "",

  setDoc: (doc) => set({ doc }),

  generate: () => {
    const { doc } = get()
    if (!doc) return

    const plain = nodeToPlain(doc)
    const json = JSON.stringify(docToCleanJson(doc), null, 2)
    const xml = nodeToXml(doc, 0)

    set({
      output: { plain, json, xml },
      name: generateName(plain),
    })
  },

  loadEntry: (entry) =>
    set({
      doc: entry.doc,
      output: entry.output,
      name: entry.name,
    }),

  reset: () => set({ doc: null, output: null, name: "" }),
}))
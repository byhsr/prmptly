import { create } from "zustand"
import { JSONContent } from "@tiptap/core"
import { nanoid } from "nanoid"
import { nodeToPlain, docToCleanJson, nodeToXml } from "@/lib/client/textEditorFuncs"
import {parseMarkdownSections} from "@/lib/editor/parseMarkdown"

export interface QuickSection {
  id: string
  title: string
  doc: JSONContent
}

export interface QuickEntry {
  id: string
  name: string
  sections: QuickSection[]
  output: { plain: string; json: string; xml: string }
  createdAt: number
}

interface QuicksStore {
  sections: QuickSection[]
  output: { plain: string; json: string; xml: string } | null
  name: string

  setSections: (sections: QuickSection[]) => void
  updateSection: (id: string, doc: JSONContent) => void
  updateSectionTitle: (id: string, title: string) => void
  loadFromPaste: (raw: string) => void
  generate: () => void
  loadEntry: (entry: QuickEntry) => void
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

  setSections: (sections) => set({ sections }),

  updateSection: (id, doc) =>
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, doc } : sec)),
    })),
    updateSectionTitle: (id, title) =>
  set((s) => ({
    sections: s.sections.map((sec) => (sec.id === id ? { ...sec, title } : sec)),
  })),

  loadFromPaste: (raw) => set({ sections: parseMarkdownSections(raw) }),

  generate: () => {
    const { sections } = get()
    if (!sections.length) return

    const plain = sections
      .map((s) => (s.title ? `${s.title}:\n${nodeToPlain(s.doc)}` : nodeToPlain(s.doc)))
      .join("\n\n")

    const json = JSON.stringify(
      sections.map((s) => ({ title: s.title || null, content: docToCleanJson(s.doc) })),
      null,
      2
    )

    const xml = sections
      .map((s) => (s.title ? `<${s.title}>\n${nodeToXml(s.doc, 1)}\n</${s.title}>` : nodeToXml(s.doc, 0)))
      .join("\n")

    set({ output: { plain, json, xml }, name: generateName(plain) })
  },

  loadEntry: (entry) => set({ sections: entry.sections, output: entry.output, name: entry.name }),

  reset: () => set({ sections: [], output: null, name: "" }),
}))
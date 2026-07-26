import { create } from "zustand"
import { JSONContent } from "@tiptap/react"
import { Document } from "@/lib/types/Document"
import { readPrompt, updatePromptContent } from "@/services/service.prompt"
import { templateService, TemplateSection } from "@/lib/db/template"
import { updateDocument } from "@/lib/db/document"
import { serializeDoc, nodeToXml } from "@/lib/client/textEditorFuncs"

export type OutputFormat = "plain" | "json" | "xml"

interface PromptStore {
  activeDocument: Document | null
  sections: TemplateSection[]
  filledSections: Record<string, string>
  filledSectionDocs: Record<string, JSONContent>
  outputFormat: OutputFormat
  compiledOutput: string
  loading: boolean
  scratchpadText: string

  loadDocument: (id: string) => Promise<void>
  updateSection: (sectionId: string, value: string, doc?: JSONContent) => void
  setOutputFormat: (format: OutputFormat) => void
  updateTemplate: (templateId: string) => Promise<void>
  clearTemplate: () => Promise<void>
  updateScratchpad: (text: string) => void
  reorderSections: (sections: TemplateSection[]) => void
  persist: () => Promise<void>
  reset: () => void
}

function compile(
  sections: TemplateSection[],
  filled: Record<string, string>,
  filledDocs: Record<string, JSONContent>,
  format: OutputFormat
): string {
  if (!sections.length) {
    const freeDoc = filledDocs["__freeform__"]
    if (freeDoc) {
      // doc could be an HTML string or JSONContent — serialize safely
      if (typeof freeDoc === "string") return freeDoc
      if (format === "xml") return `<prompt>\n${nodeToXml(freeDoc, 1)}\n</prompt>`
      return serializeDoc(freeDoc, format)
    }
    return filled["__freeform__"] || ""
  }

  const ordered = [...sections].sort((a, b) => a.order_index - b.order_index)
  const pairs = ordered.map((s) => ({
    title: s.title,
    key: s.title.toLowerCase().replace(/\s+/g, "_"),
    value: filledDocs[s.id] && typeof filledDocs[s.id] !== "string"
      ? serializeDoc(filledDocs[s.id], format)
      : filled[s.id] || "",
  }))

  if (format === "plain") {
    return pairs.map((p) => `${p.title.toUpperCase()}:\n${p.value}`).join("\n\n")
  }

  if (format === "json") {
    const obj: Record<string, unknown> = {}
    pairs.forEach((p) => {
      try {
        const parsed = JSON.parse(p.value)
        obj[p.key] = parsed?.prompt ?? parsed
      } catch {
        obj[p.key] = p.value
      }
    })
    return JSON.stringify(obj, null, 2)
  }

  if (format === "xml") {
    const inner = pairs.map((p) => {
      const content = p.value.trim()
      const indented = content.split("\n").map((l) => `    ${l}`).join("\n")
      return `  <${p.key}>\n${indented}\n  </${p.key}>`
    }).join("\n")
    return `<prompt>\n${inner}\n</prompt>`
  }

  return ""
}

export const usePromptStore = create<PromptStore>((set, get) => ({
  activeDocument: null,
  sections: [],
  filledSections: {},
  filledSectionDocs: {},
  outputFormat: "plain",
  compiledOutput: "",
  loading: false,
  scratchpadText: "",

  loadDocument: async (id: string) => {
    set({ loading: true })
    try {
      const result = await readPrompt(id)
      if (!result) {
        set({ loading: false })
        return
      }

      let sections: TemplateSection[] = []
      if (result.template_id) {
        sections = await templateService.getSections(result.template_id)
      }

      const filledSections: Record<string, string> = {}
      const filledSectionDocs: Record<string, JSONContent> = {}

      for (const entry of result.version.builder_content) {
        filledSections[entry.sectionId] = entry.value
        if (entry.doc) filledSectionDocs[entry.sectionId] = entry.doc as JSONContent
      }

      const compiledOutput = compile(sections, filledSections, filledSectionDocs, "plain")

      set({
        activeDocument: result as unknown as Document,
        sections,
        filledSections,
        filledSectionDocs,
        outputFormat: "plain",
        compiledOutput,
        loading: false,
        scratchpadText: result.version.scratchpad,
      })
    } catch (err) {
      console.error("loadDocument failed:", err)
      set({ loading: false })
    }
  },

  updateSection: (sectionId: string, value: string, doc?: JSONContent) => {
    const { sections, filledSections, filledSectionDocs, outputFormat } = get()
    const updatedFilled = { ...filledSections, [sectionId]: value }
    const updatedDocs = doc ? { ...filledSectionDocs, [sectionId]: doc } : filledSectionDocs
    const compiled = compile(sections, updatedFilled, updatedDocs, outputFormat)
    set({ filledSections: updatedFilled, filledSectionDocs: updatedDocs, compiledOutput: compiled })
    debouncedPersist()
  },

  setOutputFormat: (format: OutputFormat) => {
    const { sections, filledSections, filledSectionDocs } = get()
    const compiled = compile(sections, filledSections, filledSectionDocs, format)
    set({ outputFormat: format, compiledOutput: compiled })
  },

  updateTemplate: async (templateId: string) => {
    const { activeDocument, filledSections, sections } = get()
    if (!activeDocument) return

    const dump = sections
      .map((s) => `${s.title}:\n${filledSections[s.id] || ""}`)
      .filter((s) => s.trim())
      .join("\n\n")

    if (dump) {
      const current = get().scratchpadText
      const newScratchpad = current ? `${current}\n\n---\n\n${dump}` : dump
      get().updateScratchpad(newScratchpad)
    }

    // Update template_id on the document
    await updateDocument(activeDocument.id, { meta: { ...(activeDocument.meta || {}), template_id: templateId } })
    const newSections = await templateService.getSections(templateId)
    const outputFormat = get().outputFormat
    const compiled = compile(newSections, {}, {}, outputFormat)

    set({
      sections: newSections,
      filledSections: {},
      filledSectionDocs: {},
      compiledOutput: compiled,
      activeDocument: { ...activeDocument, templateId, meta: { ...(activeDocument.meta || {}), template_id: templateId } },
    })
  },

  clearTemplate: async () => {
    if (persistTimer) clearTimeout(persistTimer)

    const { activeDocument, filledSections, sections } = get()
    if (!activeDocument) return

    const dump = sections
      .map((s) => `${s.title}:\n${filledSections[s.id] || ""}`)
      .filter((s) => s.trim())
      .join("\n\n")

    if (dump) {
      const current = get().scratchpadText
      const newScratchpad = current ? `${current}\n\n---\n\n${dump}` : dump
      get().updateScratchpad(newScratchpad)
    }

    await updateDocument(activeDocument.id, { meta: { ...(activeDocument.meta || {}), template_id: null } })
    set({
      sections: [],
      filledSections: {},
      filledSectionDocs: {},
      compiledOutput: "",
      activeDocument: { ...activeDocument, templateId: null, meta: { ...(activeDocument.meta || {}), template_id: null } },
    })
  },

  persist: async () => {
    const { activeDocument, filledSections, filledSectionDocs, sections } = get()
    if (!activeDocument) return

    try {
      const builder_content = sections
        .sort((a, b) => a.order_index - b.order_index)
        .map((s, i) => ({
          sectionId: s.id,
          order: i,
          value: filledSections[s.id] || "",
          doc: typeof filledSectionDocs[s.id] === "string" ? null : filledSectionDocs[s.id] ?? null,
        }))

      await updatePromptContent({
        promptId: activeDocument.id,
        builder_content,
        scratchpad: get().scratchpadText,
      })

      const sectionsData = sections.map((s, i) => ({
        id: s.id,
        title: s.title,
        order: i,
        value: filledSections[s.id] || "",
        doc: typeof filledSectionDocs[s.id] === "string" ? null : filledSectionDocs[s.id] ?? null,
      }))
      await updateDocument(activeDocument.id, { sections: sectionsData })
    } catch (err) {
      console.error("persist failed:", err)
    }
  },

  updateScratchpad: (text: string) => {
    set({ scratchpadText: text })
    debouncedScratchpadPersist()
  },

  reorderSections: (reordered: TemplateSection[]) => {
    const { sections, filledSections, outputFormat, filledSectionDocs } = get()
    const compiled = compile(sections, filledSections, filledSectionDocs, outputFormat)
    set({ sections: reordered, compiledOutput: compiled })
    debouncedPersist()
  },

  reset: () => set({
    activeDocument: null,
    sections: [],
    filledSections: {},
    filledSectionDocs: {},
    outputFormat: "plain",
    compiledOutput: "",
    loading: false,
    scratchpadText: "",
  }),
}))

let persistTimer: ReturnType<typeof setTimeout> | null = null

function debouncedPersist() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    usePromptStore.getState().persist()
  }, 800)
}

let scratchpadTimer: ReturnType<typeof setTimeout> | null = null

function debouncedScratchpadPersist() {
  if (scratchpadTimer) clearTimeout(scratchpadTimer)
  scratchpadTimer = setTimeout(async () => {
    const { activeDocument, scratchpadText } = usePromptStore.getState()
    if (activeDocument) {
      const { writeFile } = await import("@/lib/fs/fs")
      const { getScratchpadPath } = await import("@/lib/fs/fsHelpers")
      const path = await getScratchpadPath(activeDocument.id)
      await writeFile(path, scratchpadText)
    }
  }, 800)
}

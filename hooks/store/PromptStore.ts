import { create } from "zustand"
import { JSONContent } from "@tiptap/react"
import { Document } from "@/lib/types/Document"
import { CanvasFlow } from "@/lib/types/canvas.types"
import { readPrompt, updatePromptContent } from "@/services/service.prompt"
import { templateService, TemplateSection } from "@/lib/db/template"
import { updateDocument } from "@/lib/db/document"
import { serializeDoc, nodeToXml } from "@/lib/client/textEditorFuncs"
import { readJson, writeJson } from "@/lib/editor/ReadAndCompile"
import { getCanvasPath } from "@/lib/fs/fsHelpers"

export type OutputFormat = "plain" | "json" | "xml"

const EMPTY_CANVAS: CanvasFlow = { nodes: [], edges: [] }

interface PromptStore {
  activeDocument: Document | null
  sections: TemplateSection[]
  filledSections: Record<string, string>
  filledSectionDocs: Record<string, JSONContent>
  outputFormat: OutputFormat
  compiledOutput: string
  loading: boolean
  scratchpadText: string
  canvasFlow: CanvasFlow

  loadDocument: (id: string) => Promise<void>
  updateSection: (sectionId: string, value: string, doc?: JSONContent) => void
  setOutputFormat: (format: OutputFormat) => void
  updateTemplate: (templateId: string) => Promise<void>
  clearTemplate: () => Promise<void>
  updateScratchpad: (text: string) => void
  updateCanvas: (flow: CanvasFlow) => void
  replaceAll: (find: string, replace: string, caseSensitive: boolean, wholeWord: boolean) => number
  reorderSections: (sections: TemplateSection[]) => void
  persist: () => Promise<void>
  reset: () => void
}

// ── Replace helpers ────────────────────────────────

function buildRegex(find: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped
  return new RegExp(pattern, caseSensitive ? "g" : "gi")
}

function countIn(text: string, regex: RegExp): number {
  const matches = text.match(regex)
  return matches ? matches.length : 0
}

function replaceInDoc(
  node: JSONContent,
  regex: RegExp,
  replace: string
): { doc: JSONContent; count: number } {
  let count = 0

  const walk = (n: JSONContent): JSONContent => {
    const next: JSONContent = { ...n }
    if (typeof next.text === "string") {
      const matches = countIn(next.text, regex)
      if (matches > 0) {
        count += matches
        next.text = next.text.replace(regex, replace)
      }
    }
    if (Array.isArray(next.content)) next.content = next.content.map(walk)
    return next
  }

  return { doc: walk(node), count }
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
  canvasFlow: EMPTY_CANVAS,

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

      const canvasFlow =
        (await readJson<CanvasFlow>(await getCanvasPath(id))) ?? EMPTY_CANVAS

      set({
        activeDocument: result as unknown as Document,
        sections,
        filledSections,
        filledSectionDocs,
        outputFormat: "plain",
        compiledOutput,
        loading: false,
        scratchpadText: result.version.scratchpad,
        canvasFlow,
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

  updateCanvas: (flow: CanvasFlow) => {
    set({ canvasFlow: flow })
    debouncedCanvasPersist()
  },

  // Store-level replace across every section — used by RectifyBar when no
  // Tiptap editor is focused (e.g. the Builder sub-tab isn't mounted).
  replaceAll: (find, replace, caseSensitive, wholeWord) => {
    const { sections, filledSections, filledSectionDocs, outputFormat } = get()
    if (!find) return 0

    const regex = buildRegex(find, caseSensitive, wholeWord)
    const nextFilled: Record<string, string> = { ...filledSections }
    const nextDocs: Record<string, JSONContent> = { ...filledSectionDocs }
    let count = 0

    const ids = new Set([
      ...Object.keys(filledSections),
      ...Object.keys(filledSectionDocs),
    ])

    for (const id of ids) {
      const doc = filledSectionDocs[id]
      if (doc && typeof doc !== "string") {
        const result = replaceInDoc(doc, regex, replace)
        nextDocs[id] = result.doc
        count += result.count
        if (typeof nextFilled[id] === "string") {
          nextFilled[id] = nextFilled[id].replace(regex, replace)
        }
      } else if (typeof nextFilled[id] === "string") {
        count += countIn(nextFilled[id], regex)
        nextFilled[id] = nextFilled[id].replace(regex, replace)
      }
    }

    if (count === 0) return 0

    const compiledOutput = compile(sections, nextFilled, nextDocs, outputFormat)
    set({ filledSections: nextFilled, filledSectionDocs: nextDocs, compiledOutput })
    debouncedPersist()
    return count
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
    canvasFlow: EMPTY_CANVAS,
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

let canvasTimer: ReturnType<typeof setTimeout> | null = null

function debouncedCanvasPersist() {
  if (canvasTimer) clearTimeout(canvasTimer)
  canvasTimer = setTimeout(async () => {
    const { activeDocument, canvasFlow } = usePromptStore.getState()
    if (!activeDocument) return
    try {
      await writeJson(await getCanvasPath(activeDocument.id), canvasFlow)
    } catch (err) {
      console.error("canvas persist failed:", err)
    }
  }, 800)
}

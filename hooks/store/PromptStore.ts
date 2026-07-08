import { create } from "zustand"
import { readPrompt } from "@/services/service.prompt"
import { templateService } from "@/lib/db/template"
import { saveBuilderContent, saveOutput, updatePromptTemplate } from "@/lib/db/document"
import { createFile } from "@/lib/fs/fs"
import type { TemplateSection, BuilderSectionContent, } from "@/lib/db/document"
import { JSONContent } from "@tiptap/react"
import { serializeDoc, nodeToXml } from "@/lib/client/textEditorFuncs"


export type OutputFormat = "plain" | "json" | "xml"

interface PromptVersion {
  id: string
  version_number: number
  label: string | null
  builder_content: BuilderSectionContent[]
  scratchpad: string
  scratchpad_text_path: string | null
  output: {
    id: string | null
    text: string | null
    json: string | null
    xml: string | null
  }
}

interface ActivePrompt {
  id: string
  name: string
  template_id: string | null
  collection_id: string | null
  version: PromptVersion
}

interface PromptStore {
  activePrompt: ActivePrompt | null
  sections: TemplateSection[]
  filledSections: Record<string, string>
  filledSectionDocs: Record<string, JSONContent>  // add
  outputFormat: OutputFormat
  compiledOutput: string
  loading: boolean
  scratchpadText: string
  clearTemplate: () => Promise<void>

  // Actions
  loadPrompt: (promptId: string) => Promise<void>
  updateScratchpad: (text: string) => void
  reorderSections: (sections: TemplateSection[]) => void
  updateTemplate: (templateId: string) => Promise<void>
  updateSection: (sectionId: string, value: string, doc?: JSONContent) => void  // doc optional, no breaking changes
  setOutputFormat: (format: OutputFormat) => void
  persist: () => Promise<void>
  reset: () => void
}

// ── Compile ────────────────────────────────────────────────────────────────────


function compile(
  sections: TemplateSection[],
  filled: Record<string, string>,
  filledDocs: Record<string, JSONContent>,  // add this
  format: OutputFormat
): string {
  if (!sections.length) {
    const freeDoc = filledDocs["__freeform__"]
    if (freeDoc) {
      if (format === "xml") return `<prompt>\n${nodeToXml(freeDoc, 1)}\n</prompt>`
      return serializeDoc(freeDoc, format)
    }
    return filled["__freeform__"] || ""
  }

  const ordered = [...sections].sort((a, b) => a.order_index - b.order_index)
  const pairs = ordered.map((s) => ({
    title: s.title,
    key: s.title.toLowerCase().replace(/\s+/g, "_"),
    // serialize each section's doc in the target format
    value: filledDocs[s.id] ? serializeDoc(filledDocs[s.id], format) : filled[s.id] || "",
  }))

  if (format === "plain") {
    return pairs
      .map((p) => `${p.title.toUpperCase()}:\n${p.value}`)
      .join("\n\n")
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

// ── Store ──────────────────────────────────────────────────────────────────────

export const usePromptStore = create<PromptStore>((set, get) => ({
  activePrompt: null,
  sections: [],
  filledSections: {},
  outputFormat: "plain",
  compiledOutput: "",
  loading: false,
  filledSectionDocs: {} as Record<string, JSONContent>,

  loadPrompt: async (promptId: string) => {
    set({ loading: true })
    try {
      const result = await readPrompt(promptId)
      if (!result) return

      let sections: TemplateSection[] = []
      if (result.template_id) {
        sections = await templateService.getSections(result.template_id)
      }

      const filledSections: Record<string, string> = {}
      const filledSectionDocs: Record<string, JSONContent> = {}

      for (const entry of result.version.builder_content) {
        filledSections[entry.sectionId] = entry.value
        if (entry.doc) filledSectionDocs[entry.sectionId] = entry.doc
      }
      const compiledOutput = compile(sections, filledSections, filledSectionDocs, "plain")

      set({
        activePrompt: result as ActivePrompt,
        sections,
        filledSections,
        filledSectionDocs,
        outputFormat: "plain",
        compiledOutput,
        loading: false,
        scratchpadText: result.version.scratchpad,
      })
    } catch (err) {
      console.error("loadPrompt failed:", err)
      set({ loading: false })
    }
  },
  scratchpadText: "",

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
  const { activePrompt, filledSections, filledSectionDocs, outputFormat, sections } = get()
  if (!activePrompt) return

  // Dump current content to scratchpad before wiping
  const dump = sections
    .map((s) => `${s.title}:\n${filledSections[s.id] || ""}`)
    .filter((s) => s.trim())
    .join("\n\n")

  if (dump) {
    const current = get().scratchpadText
    const newScratchpad = current ? `${current}\n\n---\n\n${dump}` : dump
    get().updateScratchpad(newScratchpad)
  }

  await updatePromptTemplate(activePrompt.id, templateId)
  const newSections = await templateService.getSections(templateId)
  const compiled = compile(newSections, {}, {}, outputFormat)

  set({
    sections: newSections,
    filledSections: {},
    filledSectionDocs: {},
    compiledOutput: compiled,
    activePrompt: { ...activePrompt, template_id: templateId },
  })
},

  persist: async () => {
    const { activePrompt, filledSections, filledSectionDocs, sections, compiledOutput, outputFormat } = get()
    if (!activePrompt) return

    const builderContent: BuilderSectionContent[] = sections
      .sort((a, b) => a.order_index - b.order_index)
      .map((s, i) => ({
        sectionId: s.id,
        order: i,
        value: filledSections[s.id] || "",
        doc: filledSectionDocs[s.id],
      }))

    await saveBuilderContent(activePrompt.version.id, builderContent)

    const outputId = activePrompt.version.output.id
    if (outputId) {
      await saveOutput(
        outputId,
        outputFormat === "plain" ? compiledOutput : null,
        outputFormat === "json" ? compiledOutput : null,
        outputFormat === "xml" ? compiledOutput : null,
      )
    }
  },

  clearTemplate: async () => {
  if (persistTimer) clearTimeout(persistTimer)

  const { activePrompt, filledSections, filledSectionDocs, sections, outputFormat } = get()
  if (!activePrompt) return

  // Dump to scratchpad
  const dump = sections
    .map((s) => `${s.title}:\n${filledSections[s.id] || ""}`)
    .filter((s) => s.trim())
    .join("\n\n")

  if (dump) {
    const current = get().scratchpadText
    const newScratchpad = current ? `${current}\n\n---\n\n${dump}` : dump
    get().updateScratchpad(newScratchpad)
  }

  await updatePromptTemplate(activePrompt.id, null)
  set({
    sections: [],
    filledSections: {},
    filledSectionDocs: {},
    compiledOutput: "",
    activePrompt: { ...activePrompt, template_id: null },
  })
},

  reset: () => set({
    activePrompt: null,
    sections: [],
    filledSections: {},
    outputFormat: "plain",
    compiledOutput: "",
    loading: false,
    scratchpadText: "",
  }),

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
}))

// ── Debounce ───────────────────────────────────────────────────────────────────

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
    const { activePrompt, scratchpadText } = usePromptStore.getState()
    const path = activePrompt?.version.scratchpad_text_path
    if (path) await createFile(path, scratchpadText)
  }, 800)
}
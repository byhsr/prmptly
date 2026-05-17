import { create } from "zustand"
import { readPrompt } from "@/services/service.prompt"
import { templateService } from "@/lib/db/template"
import { saveBuilderContent, saveOutput, updatePromptTemplate  } from "@/lib/db/prompt"
import type { TemplateSection, BuilderSectionContent, } from "@/lib/db/prompt"



export type OutputFormat = "plain" | "json" | "xml"

interface PromptVersion {
  id: string
  version_number: number
  label: string | null
  builder_content: BuilderSectionContent[]
  scratchpad: string
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
  filledSections: Record<string, string> // sectionId → value
  outputFormat: OutputFormat
  compiledOutput: string
  loading: boolean
  
  // Actions
  
  loadPrompt: (promptId: string) => Promise<void>
  reorderSections: (sections: TemplateSection[]) => void
  updateTemplate: (templateId: string) => Promise<void>
  updateSection: (sectionId: string, value: string) => void
  setOutputFormat: (format: OutputFormat) => void
  persist: () => Promise<void>
  reset: () => void
}

// ── Compile ────────────────────────────────────────────────────────────────────

function compile(
  sections: TemplateSection[],
  filled: Record<string, string>,
  format: OutputFormat
): string {
  const ordered = [...sections].sort((a, b) => a.order_index - b.order_index)
  const pairs = ordered.map((s) => ({ title: s.title, value: filled[s.id] || "" }))

  if (format === "plain") {
    return pairs
      .map((p) => `${p.title.toUpperCase()}:\n${p.value}`)
      .join("\n\n")
  }

  if (format === "json") {
    const obj: Record<string, string> = {}
    pairs.forEach((p) => {
      const key = p.title.toLowerCase().replace(/\s+/g, "_")
      obj[key] = p.value
    })
    return JSON.stringify(obj, null, 2)
  }

  if (format === "xml") {
    const inner = pairs
      .map((p) => {
        const tag = p.title.toLowerCase().replace(/\s+/g, "_")
        return `  <${tag}>${p.value}</${tag}>`
      })
      .join("\n")
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

  loadPrompt: async (promptId: string) => {
    set({ loading: true })
    try {
      const result = await readPrompt(promptId)
      if (!result) return

      let sections: TemplateSection[] = []
      if (result.template_id) {
        sections = await templateService.getSections(result.template_id)
      }

      // builder_content array → Record<sectionId, value>
      const filledSections: Record<string, string> = {}
      for (const entry of result.version.builder_content) {
        filledSections[entry.sectionId] = entry.value
      }

      const compiledOutput = compile(sections, filledSections, "plain")

      set({
        activePrompt: result as ActivePrompt,
        sections,
        filledSections,
        outputFormat: "plain",
        compiledOutput,
        loading: false,
      })
    } catch (err) {
      console.error("loadPrompt failed:", err)
      set({ loading: false })
    }
  },

  updateSection: (sectionId: string, value: string) => {
    const { sections, filledSections, outputFormat } = get()
    const updated = { ...filledSections, [sectionId]: value }
    const compiled = compile(sections, updated, outputFormat)
    set({ filledSections: updated, compiledOutput: compiled })
    debouncedPersist()
  },

  setOutputFormat: (format: OutputFormat) => {
    const { sections, filledSections } = get()
    const compiled = compile(sections, filledSections, format)
    set({ outputFormat: format, compiledOutput: compiled })
  },
  updateTemplate: async (templateId: string) => {
  const { activePrompt, filledSections, outputFormat } = get()
  if (!activePrompt) return

  await updatePromptTemplate(activePrompt.id, templateId)
  const sections = await templateService.getSections(templateId)
  const compiled = compile(sections, filledSections, outputFormat)

  set({
    sections,
    compiledOutput: compiled,
    activePrompt: { ...activePrompt, template_id: templateId },
  })
},

  persist: async () => {
    const { activePrompt, filledSections, sections, compiledOutput, outputFormat } = get()
    if (!activePrompt) return

    const builderContent: BuilderSectionContent[] = sections
      .sort((a, b) => a.order_index - b.order_index)
      .map((s, i) => ({
        sectionId: s.id,
        order: i,
        value: filledSections[s.id] || "",
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

  reset: () => set({
    activePrompt: null,
    sections: [],
    filledSections: {},
    outputFormat: "plain",
    compiledOutput: "",
    loading: false,
  }),

  reorderSections: (reordered: TemplateSection[]) => {
  const { filledSections, outputFormat } = get()
  const compiled = compile(reordered, filledSections, outputFormat)
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
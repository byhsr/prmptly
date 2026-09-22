import { create } from "zustand"
import { Document } from "@/lib/types/Document"
import { readPrompt, updatePromptContent } from "@/services/service.prompt"
import { templateService, TemplateSection } from "@/lib/db/template"
import { updateDocument } from "@/lib/db/document"
import type { PromptFormat } from "@/lib/editor/outputs"

export type OutputFormat = PromptFormat

const BODY_SECTION_ID = "body"

interface PromptStore {
  activeDocument: Document | null
  body: string
  loadKey: number
  outputFormat: OutputFormat
  loading: boolean
  scratchpadText: string

  loadDocument: (id: string) => Promise<void>
  setBody: (body: string) => void
  setOutputFormat: (format: OutputFormat) => void
  updateTemplate: (templateId: string) => Promise<void>
  clearTemplate: () => Promise<void>
  updateScratchpad: (text: string) => void
  replaceAll: (find: string, replace: string, caseSensitive: boolean, wholeWord: boolean) => number
  persist: () => Promise<void>
  reset: () => void
}

// ── Body <-> storage ──────────────────────────────────────────────────────────

// Legacy prompts stored one entry per template section — join them back into one body.
function bodyFromBuilderContent(content: { value?: string }[]): string {
  return (content ?? []).map((c) => c.value || "").filter(Boolean).join("\n\n")
}

// `content_json` is free-text in practice, so the parse is guarded. An empty `{}`
// (the column default) yields no body rather than a literal "{}".
function templateBodyText(contentJson: string | null | undefined): string {
  if (!contentJson) return ""
  try {
    const parsed = JSON.parse(contentJson)
    if (typeof parsed === "string") return parsed
    if (parsed && typeof parsed === "object") {
      for (const key of ["default", "content", "placeholder", "text", "value"]) {
        const v = (parsed as Record<string, unknown>)[key]
        if (typeof v === "string" && v.trim()) return v
      }
    }
    return ""
  } catch {
    return contentJson
  }
}

// A template is a markdown scaffold: each section becomes a `## heading` block.
function scaffoldFromSections(sections: TemplateSection[]): string {
  return sections
    .map((s) => {
      const text = templateBodyText(s.content_json)
      return text ? `## ${s.title}\n${text}` : `## ${s.title}`
    })
    .join("\n\n")
}

function buildRegex(find: string, caseSensitive: boolean, wholeWord: boolean): RegExp {
  const escaped = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const pattern = wholeWord ? `\\b${escaped}\\b` : escaped
  return new RegExp(pattern, caseSensitive ? "g" : "gi")
}

export const usePromptStore = create<PromptStore>((set, get) => ({
  activeDocument: null,
  body: "",
  loadKey: 0,
  outputFormat: "markdown",
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

      let body = bodyFromBuilderContent(result.version.builder_content)

      // Template-backed prompt with nothing written yet — seed from the blueprint.
      if (!body && result.template_id) {
        body = scaffoldFromSections(await templateService.getSections(result.template_id))
      }

      set({
        activeDocument: result as unknown as Document,
        body,
        loadKey: get().loadKey + 1,
        outputFormat: "markdown",
        loading: false,
        scratchpadText: result.version.scratchpad,
      })
    } catch (err) {
      console.error("loadDocument failed:", err)
      set({ loading: false })
    }
  },

  setBody: (body: string) => {
    set({ body })
    debouncedPersist()
  },

  setOutputFormat: (format: OutputFormat) => {
    set({ outputFormat: format })
  },

  updateTemplate: async (templateId: string) => {
    const { activeDocument, body, scratchpadText } = get()
    if (!activeDocument) return

    // Keep the previous body — dropping it into the scratchpad preserves user work.
    if (body.trim()) {
      const nextScratchpad = scratchpadText ? `${scratchpadText}\n\n---\n\n${body}` : body
      get().updateScratchpad(nextScratchpad)
    }

    const sections = await templateService.getSections(templateId)
    const nextBody = scaffoldFromSections(sections)

    // Write the real template_id column — loadDocument reads it back from there.
    await updateDocument(activeDocument.id, { templateId })

    set({
      body: nextBody,
      loadKey: get().loadKey + 1,
      activeDocument: { ...activeDocument, templateId },
    })
    debouncedPersist()
  },

  clearTemplate: async () => {
    const { activeDocument } = get()
    if (!activeDocument) return

    await updateDocument(activeDocument.id, { templateId: null })
    set({ activeDocument: { ...activeDocument, templateId: null } })
  },

  persist: async () => {
    const { activeDocument, body, scratchpadText } = get()
    if (!activeDocument) return

    try {
      await updatePromptContent({
        promptId: activeDocument.id,
        builder_content: [{ sectionId: BODY_SECTION_ID, order: 0, value: body }],
        scratchpad: scratchpadText,
      })
    } catch (err) {
      console.error("persist failed:", err)
    }
  },

  updateScratchpad: (text: string) => {
    set({ scratchpadText: text })
    debouncedScratchpadPersist()
  },

  // Replace across the whole body — used by RectifyBar when no editor instance is
  // focused (e.g. the Builder sub-tab isn't mounted).
  replaceAll: (find, replace, caseSensitive, wholeWord) => {
    const { body } = get()
    if (!find || !body) return 0

    const regex = buildRegex(find, caseSensitive, wholeWord)
    const matches = body.match(regex)
    const count = matches ? matches.length : 0
    if (!count) return 0

    const nextBody = body.replace(regex, replace)
    set({ body: nextBody, loadKey: get().loadKey + 1 })
    debouncedPersist()
    return count
  },

  reset: () => set({
    activeDocument: null,
    body: "",
    loadKey: 0,
    outputFormat: "markdown",
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


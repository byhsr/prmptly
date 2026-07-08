import { JSONContent } from "@tiptap/react"
import { CanvasFlow } from "@/lib/types/canvas.types"
import { Document } from "@/lib/db/document"
import { TemplateSection } from "@/lib/db/template"

export type OutputFormat = "plain" | "json" | "xml"

export interface DocumentStore {
  activeDocument: Document | null

  sections: TemplateSection[]

  sectionValues: Record<string, string>
  sectionDocs: Record<string, JSONContent>

  scratchpadText: string
  scratchpadFlow: CanvasFlow

  outputFormat: OutputFormat
  compiledOutput: string

  loading: boolean

  // actions
  loadDocument: (id: string) => Promise<void>

  saveDocument: () => Promise<void>

  updateSection: (
    sectionId: string,
    value: string,
    doc?: JSONContent
  ) => void

  updateScratchpad: (text: string) => void

  updateCanvas: (flow: CanvasFlow) => void

  reorderSections: (sections: TemplateSection[]) => void

  setTemplate: (templateId: string | null) => Promise<void>

  setOutputFormat: (format: OutputFormat) => void

  reset: () => void
}
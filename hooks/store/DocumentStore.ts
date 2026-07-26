import { JSONContent } from "@tiptap/react"
import { CanvasFlow } from "@/lib/types/canvas.types"
import { Document, DocumentSection } from "@/lib/types/Document"

export type OutputFormat = "plain" | "json" | "xml"

export interface DocumentStore {
  activeDocument: Document | null

  sections: DocumentSection[]

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

  reorderSections: (sections: DocumentSection[]) => void

  setTemplate: (templateId: string | null) => Promise<void>

  setOutputFormat: (format: OutputFormat) => void

  reset: () => void
}

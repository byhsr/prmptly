import { CanvasFlow } from "@/lib/types/canvas.types"
import { CreateDocumentInput, Document, OutputFormat } from "@/lib/types/Document"

import {
  createDocument,
  deleteDocument,
  getDocument,
  updateDocument,

} from "@/lib/db/document"

import { readFile, writeFile } from "@/lib/fs/fs"

import {
  readJson,
  writeJson,
  buildOutput,
} from "@/lib/editor/ReadAndCompile"

export interface DocumentState {
  document: Document
  scratchpad: string
  canvas: CanvasFlow
  output: string
}

const EMPTY_CANVAS: CanvasFlow = {
  nodes: [],
  edges: [],
}

function scratchpadPath(document: Document) {
  if (!document.scratchpadTextPath) {
    throw new Error(`Missing scratchpad path for document ${document.id}`)
  }

  return document.scratchpadTextPath
}

function canvasPath(document: Document) {
  if (!document.scratchpadFlowPath) {
    throw new Error(`Missing canvas path for document ${document.id}`)
  }

  return document.scratchpadFlowPath
}

function outputPath(document: Document) {
  if (!document.outputPath) {
    throw new Error(`Missing output path for document ${document.id}`)
  }

  return document.outputPath
}

export const documentService = {
  async loadDocument(
    id: string,
    format: OutputFormat = "plain"
  ): Promise<DocumentState> {
    const document = await getDocument(id)

    if (!document) {
      throw new Error(`Document "${id}" not found`)
    }

    const scratchpad =
      (await readFile(scratchpadPath(document)).catch(() => "")) ?? ""

    const canvas =
      (await readJson<CanvasFlow>(canvasPath(document))) ??
      EMPTY_CANVAS

    const output = buildOutput(document.sections, format)

    return {
      document,
      scratchpad,
      canvas,
      output,
    }
  },

  async saveDocument(
    state: DocumentState
  ): Promise<Document> {
    const { document, scratchpad, canvas, output } = state

    const updated = await updateDocument(document.id, {
      sections: document.sections,
    })

    await Promise.all([
      writeFile(scratchpadPath(updated), scratchpad),
      writeJson(canvasPath(updated), canvas),
      writeJson(outputPath(updated), {
        output,
      }),
    ])

    return updated
  },

  async createDocument(
    input: CreateDocumentInput,
    format: OutputFormat = "plain"
  ): Promise<DocumentState> {
    const document = await createDocument(input)

    const output = buildOutput(document.sections, format)

    await Promise.all([
      writeFile(scratchpadPath(document), ""),
      writeJson(canvasPath(document), EMPTY_CANVAS),
      writeJson(outputPath(document), {
        output,
      }),
    ])

    return {
      document,
      scratchpad: "",
      canvas: EMPTY_CANVAS,
      output,
    }
  },

  async deleteDocument(id: string): Promise<void> {
    await deleteDocument(id)
    // delete document directory here if desired
  },
}
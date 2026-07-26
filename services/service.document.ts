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

import { getScratchpadPath, getCanvasPath, getOutputPath, getDocumentDir } from "@/lib/fs/fsHelpers"

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

async function readScratchpad(document: Document): Promise<string> {
  if (!document.scratchpadTextPath) return ""
  return readFile(document.scratchpadTextPath).catch(() => "")
}

async function readCanvas(document: Document): Promise<CanvasFlow> {
  if (!document.scratchpadFlowPath) return EMPTY_CANVAS
  return (await readJson<CanvasFlow>(document.scratchpadFlowPath)) ?? EMPTY_CANVAS
}

export const documentService = {
  async loadDocument(
    id: string,
    format: OutputFormat = "plain"
  ): Promise<DocumentState> {
    const document = await getDocument(id)
    if (!document) throw new Error(`Document "${id}" not found`)

    const scratchpad = await readScratchpad(document)
    const canvas = await readCanvas(document)
    const output = buildOutput(document.sections, format)

    return { document, scratchpad, canvas, output }
  },

  async saveDocument(state: DocumentState): Promise<Document> {
    const { document, scratchpad, canvas, output } = state

    const updated = await updateDocument(document.id, {
      sections: document.sections,
    })

    const scratchpadPath = document.scratchpadTextPath ?? await getScratchpadPath(document.id)
    const canvasPath = document.scratchpadFlowPath ?? await getCanvasPath(document.id)
    const outputFilePath = await getOutputPath(document.id)

    await Promise.all([
      writeFile(scratchpadPath, scratchpad),
      writeJson(canvasPath, canvas),
      writeJson(outputFilePath, { output }),
    ])

    return updated
  },

  async create(
    input: CreateDocumentInput,
    format: OutputFormat = "plain"
  ): Promise<DocumentState> {
    const document = await createDocument(input)
    const output = buildOutput(document.sections, format)

    const docDir = await getDocumentDir(document.id)
    const { ensureDirectory } = await import("@/lib/fs/fs")
    await ensureDirectory(docDir)

    await Promise.all([
      writeFile(await getScratchpadPath(document.id), ""),
      writeJson(await getCanvasPath(document.id), EMPTY_CANVAS),
      writeJson(await getOutputPath(document.id), { output }),
    ])

    return { document, scratchpad: "", canvas: EMPTY_CANVAS, output }
  },

  async remove(id: string): Promise<void> {
    await deleteDocument(id)
  },
}

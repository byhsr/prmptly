import {JSONContent} from "@tiptap/react"

export interface DocumentSection {
  id: string

  // Optional link back to the template section it originated from
  templateSectionId?: string

  title: string

  order: number

  value: string

  doc?: JSONContent

  collapsed?: boolean

  pinned?: boolean

  meta?: Record<string, unknown>
}

export type OutputFormat = "plain" | "json" | "xml"

export type DocumentType = "quick" | "prompt";

export interface DocumentRow {
  id: string;
  type: DocumentType;
  name: string;
  template_id: string | null;
  collection_id: string | null;
  sections_json: string;
  scratchpad_text_path: string | null;
  scratchpad_flow_path: string | null;
  output_id: string | null;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string

  type: DocumentType

  name: string

  templateId: string | null

  collectionId: string |null

  sections: DocumentSection[]

  scratchpadTextPath: string | null

  scratchpadFlowPath: string | null

  outputId: string | null

  meta: Record<string, unknown>

  createdAt: string

  updatedAt: string
}

export interface CreateDocumentInput {
  type: DocumentType;
  name: string;
  templateId?: string | null;
  collectionId?: string | null;
  sections: unknown;
  meta?: Record<string, unknown>;
}

export interface UpdateDocumentInput {
  name?: string;
  collectionId?: string | null;
  sections?: unknown;
  scratchpadTextPath?: string | null;
  scratchpadFlowPath?: string | null;
  outputId?: string | null;
  meta?: Record<string, unknown>;
}

export interface CommentRow {
  id: string
  document_id: string
  section_id: string
  anchor_from: number
  anchor_to: number
  quoted_text: string
  body: string
  resolved: number
  created_at: string
  updated_at: string
}

export interface CommentRecord {
  id: string
  documentId: string
  sectionId: string
  anchorFrom: number
  anchorTo: number
  quotedText: string
  body: string
  resolved: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateCommentInput {
  documentId: string
  sectionId: string
  anchorFrom: number
  anchorTo: number
  quotedText: string
  body: string
}

export interface UpdateCommentInput {
  body?: string
  resolved?: boolean
  anchorFrom?: number
  anchorTo?: number
  quotedText?: string
}

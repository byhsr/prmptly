// lib/db/comment.ts
import { CommentRecord, CommentRow, CreateCommentInput, UpdateCommentInput } from "@/lib/types/CommentTypes"
import { getDB } from "../lib/db/index"


export function mapRow(row: CommentRow): CommentRecord {
  return {
    id: row.id,
    documentId: row.document_id,
    sectionId: row.section_id,
    anchorFrom: row.anchor_from,
    anchorTo: row.anchor_to,
    quotedText: row.quoted_text,
    body: row.body,
    resolved: !!row.resolved,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createComment(
  input: CreateCommentInput
): Promise<CommentRecord> {
  const db = getDB()
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  await db.execute(
    `INSERT INTO comments (
      id, document_id, section_id, anchor_from, anchor_to,
      quoted_text, body, resolved, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      id,
      input.documentId,
      input.sectionId,
      input.anchorFrom,
      input.anchorTo,
      input.quotedText,
      input.body,
      now,
      now,
    ]
  )

  const comment = await getComment(id)
  if (!comment) throw new Error("Failed to create comment")
  return comment
}

export async function getComment(id: string): Promise<CommentRecord | null> {
  const db = getDB()
  const rows = await db.select<CommentRow[]>(
    `SELECT * FROM comments WHERE id = ?`,
    [id]
  )
  return rows[0] ? mapRow(rows[0]) : null
}

export async function listComments(opts: {
  documentId: string
  sectionId?: string
  resolved?: boolean
}): Promise<CommentRecord[]> {
  const db = getDB()

  const clauses = ["document_id = ?"]
  const params: unknown[] = [opts.documentId]

  if (opts.sectionId !== undefined) {
    clauses.push("section_id = ?")
    params.push(opts.sectionId)
  }
  if (opts.resolved !== undefined) {
    clauses.push("resolved = ?")
    params.push(opts.resolved ? 1 : 0)
  }

  const rows = await db.select<CommentRow[]>(
    `SELECT * FROM comments WHERE ${clauses.join(" AND ")} ORDER BY anchor_from ASC`,
    params
  )

  return rows.map(mapRow)
}

export async function updateComment(
  id: string,
  input: UpdateCommentInput
): Promise<CommentRecord> {
  const db = getDB()
  const sets: string[] = []
  const params: unknown[] = []

  if (input.body !== undefined) {
    sets.push("body = ?")
    params.push(input.body)
  }
  if (input.resolved !== undefined) {
    sets.push("resolved = ?")
    params.push(input.resolved ? 1 : 0)
  }
  if (input.anchorFrom !== undefined) {
    sets.push("anchor_from = ?")
    params.push(input.anchorFrom)
  }
  if (input.anchorTo !== undefined) {
    sets.push("anchor_to = ?")
    params.push(input.anchorTo)
  }
  if (input.quotedText !== undefined) {
    sets.push("quoted_text = ?")
    params.push(input.quotedText)
  }

  if (sets.length === 0) {
    const existing = await getComment(id)
    if (!existing) throw new Error("Comment not found")
    return existing
  }

  sets.push("updated_at = ?")
  params.push(new Date().toISOString())
  params.push(id)

  await db.execute(`UPDATE comments SET ${sets.join(", ")} WHERE id = ?`, params)

  const comment = await getComment(id)
  if (!comment) throw new Error("Comment not found after update")
  return comment
}

export async function resolveComment(id: string): Promise<CommentRecord> {
  return updateComment(id, { resolved: true })
}

export async function deleteComment(id: string): Promise<void> {
  const db = getDB()
  await db.execute(`DELETE FROM comments WHERE id = ?`, [id])
}
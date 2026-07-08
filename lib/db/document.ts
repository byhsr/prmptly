import { getDB } from "./index";
import { DocumentRow, Document, CreateDocumentInput, UpdateDocumentInput, DocumentType, DocumentSection } from "@/lib/types/Document";
// ── Types ──────────────────────────────────────────



// ── Mapper ─────────────────────────────────────────

function mapRow(row: DocumentRow): Document {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    templateId: row.template_id,
    collectionId: row.collection_id,
    sections: JSON.parse(row.sections_json) as DocumentSection[],
    scratchpadTextPath: row.scratchpad_text_path,
    scratchpadFlowPath: row.scratchpad_flow_path,
    outputId: row.output_id,
    meta: row.meta_json ? JSON.parse(row.meta_json) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Create ─────────────────────────────────────────

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const db = getDB();

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO documents (
      id, type, name, template_id, collection_id,
      sections_json, meta_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.type,
      input.name,
      input.templateId ?? null,
      input.collectionId ?? null,
      JSON.stringify(input.sections),
      JSON.stringify(input.meta ?? {}),
      now,
      now,
    ]
  );

  const doc = await getDocument(id);
  if (!doc) throw new Error("Failed to create document");
  return doc;
}

// ── Read ───────────────────────────────────────────

export async function getDocument(id: string): Promise<Document | null> {
  const db = getDB();

  const rows = await db.select<DocumentRow[]>(
    `SELECT * FROM documents WHERE id = ?`,
    [id]
  );

  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listDocuments(opts?: {
  type?: DocumentType;
  collectionId?: string | null;
}): Promise<Document[]> {
  const db = getDB();

  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts?.type) {
    clauses.push("type = ?");
    params.push(opts.type);
  }

  if (opts?.collectionId !== undefined) {
    if (opts.collectionId === null) {
      clauses.push("collection_id IS NULL");
    } else {
      clauses.push("collection_id = ?");
      params.push(opts.collectionId);
    }
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = await db.select<DocumentRow[]>(
    `SELECT * FROM documents ${where} ORDER BY updated_at DESC`,
    params
  );

  return rows.map(mapRow);
}

// ── Update ─────────────────────────────────────────

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput
): Promise<Document> {
  const db = getDB();

  const sets: string[] = [];
  const params: unknown[] = [];

  if (input.name !== undefined) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.collectionId !== undefined) {
    sets.push("collection_id = ?");
    params.push(input.collectionId);
  }
  if (input.sections !== undefined) {
    sets.push("sections_json = ?");
    params.push(JSON.stringify(input.sections));
  }
  if (input.scratchpadTextPath !== undefined) {
    sets.push("scratchpad_text_path = ?");
    params.push(input.scratchpadTextPath);
  }
  if (input.scratchpadFlowPath !== undefined) {
    sets.push("scratchpad_flow_path = ?");
    params.push(input.scratchpadFlowPath);
  }
  if (input.outputId !== undefined) {
    sets.push("output_id = ?");
    params.push(input.outputId);
  }
  if (input.meta !== undefined) {
    sets.push("meta_json = ?");
    params.push(JSON.stringify(input.meta));
  }

  if (sets.length === 0) {
    const existing = await getDocument(id);
    if (!existing) throw new Error("Document not found");
    return existing;
  }

  sets.push("updated_at = ?");
  params.push(new Date().toISOString());

  params.push(id);

  await db.execute(
    `UPDATE documents SET ${sets.join(", ")} WHERE id = ?`,
    params
  );

  const doc = await getDocument(id);
  if (!doc) throw new Error("Document not found after update");
  return doc;
}

// ── Delete ─────────────────────────────────────────

export async function deleteDocument(id: string): Promise<void> {
  const db = getDB();
  await db.execute(`DELETE FROM documents WHERE id = ?`, [id]);
}

// ── Duplicate (your "new version" flow) ────────────

export async function duplicateDocument(
  id: string,
  overrides?: { name?: string; collectionId?: string | null }
): Promise<Document> {
  const source = await getDocument(id);
  if (!source) throw new Error("Document not found");

  return createDocument({
    type: source.type,
    name: overrides?.name ?? `${source.name} (copy)`,
    templateId: source.templateId,
    collectionId: overrides?.collectionId ?? source.collectionId,
    sections: source.sections,
    meta: source.meta,
  });
}
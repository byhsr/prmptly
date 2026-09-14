import { getSetting, setSetting, getDB } from "./index";
import type { Conversation } from "../ai/types";

const CONV_PREFIX = "conv:";

export async function loadConversations(documentId?: string): Promise<Conversation[]> {
  const db = getDB();
  const sql = documentId
    ? `SELECT messages_json FROM conversations WHERE document_id = ? ORDER BY created_at DESC`
    : `SELECT messages_json FROM conversations ORDER BY created_at DESC`;
  const params = documentId ? [documentId] : [];
  const rows = await db.select<{ messages_json: string }[]>(sql, params);
  return rows.map((r) => JSON.parse(r.messages_json));
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  const raw = await getSetting(CONV_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

export async function saveConversation(conv: Conversation): Promise<void> {
  // Save full object in app_settings (for quick lookups)
  await setSetting(CONV_PREFIX + conv.id, JSON.stringify(conv));

  // Also save to conversations table for document-indexed queries
  const db = getDB();
  const existing = await db.select<{ id: string }[]>(
    `SELECT id FROM conversations WHERE id = ?`,
    [conv.id],
  );
  if (existing.length > 0) {
    await db.execute(
      `UPDATE conversations SET title = ?, messages_json = ?, updated_at = ? WHERE id = ?`,
      [conv.title, JSON.stringify(conv), conv.updated, conv.id],
    );
  } else {
    await db.execute(
      `INSERT INTO conversations (id, document_id, title, messages_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [conv.id, conv.documentId ?? null, conv.title, JSON.stringify(conv), conv.created, conv.updated],
    );
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const db = getDB();
  await db.execute(`DELETE FROM conversations WHERE id = ?`, [id]);
  // Clean up app_settings entry too
  try {
    const { setSetting: ss } = await import("./index");
    await ss(CONV_PREFIX + id, "");
  } catch { /* ignore */ }
}

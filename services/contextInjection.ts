import { getDB } from "../lib/db";
import { MentionItem } from "@/components/ui/SmartTextEditor";

export interface Namespace {
    prefix: string
    source: "deterministic" | "rag"
}

// ─── All namespaces for the initial @ dropdown ────────────────────────────────
export async function getNamespaces(): Promise<Namespace[]> {
    const db = await getDB()
    return db.select<Namespace[]>(`SELECT prefix, source FROM namespaces ORDER BY prefix ASC`)
}

// ─── Resolve a mention string like "writer:persona" ──────────────────────────
export async function resolveMention(raw: string): Promise<{ type: "deterministic"; value: string } | { type: "rag"; prefix: string; query: string } | null> {
    const colonIdx = raw.indexOf(":")
    if (colonIdx === -1) return null

    const prefix = raw.slice(0, colonIdx)       // "writer"
    const rest   = raw.slice(colonIdx + 1)      // "persona"  or  "some user query"

    const db = await getDB()
    const rows = await db.select<Namespace[]>(
        `SELECT prefix, source FROM namespaces WHERE prefix = ?`, [prefix]
    )
    const ns = rows[0]
    if (!ns) return null

    if (ns.source === "deterministic") {
        const key = `${prefix}:${rest}`         // "writer:persona"
        const asset = await db.select<{ value: string }[]>(
            `SELECT value FROM deterministic_assets WHERE key = ?`, [key]
        )
        return asset[0] ? { type: "deterministic", value: asset[0].value } : null
    }

    // rag — caller handles vector search with prefix as scope + rest as query
    return { type: "rag", prefix, query: rest }
}


export async function getDeterministicKeys(prefix: string): Promise<MentionItem[]> {
    const db = await getDB()
    const rows = await db.select<{ key: string }[]>(
        `SELECT key FROM deterministic_assets WHERE key LIKE ?`, [`${prefix}:%`]
    )
    return rows.map((r) => ({ id: r.key, label: r.key, source: "deterministic" as const }))
}
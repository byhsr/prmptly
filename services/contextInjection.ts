import { getDB } from "../lib/db";
import { MentionItem } from "@/components/ui/SmartTextEditor";

export interface Namespace {
    prefix: string
    source: "deterministic" | "rag"
}

// ─── All namespaces for the initial @ dropdown ────────────────────────────────
export async function getNamespaces(): Promise<Namespace[]> {
    const db = await getDB()
    return db.select<Namespace[]>(`SELECT prefix, source FROM namespaces WHERE prefix != '__global__' ORDER BY prefix ASC`)
}

// ─── Resolve a mention string like "writer:persona" ──────────────────────────
export async function resolveMention(raw: string): Promise<{ type: "deterministic"; value: string } | { type: "rag"; prefix: string; query: string } | null> {
    const colonIdx = raw.indexOf(":")
    if (colonIdx === -1) return null

    const ns = raw.slice(0, colonIdx)       // "writer"
    const key = raw.slice(colonIdx + 1)     // "persona"

    const db = await getDB()
    const rows = await db.select<{ source: string }[]>(
        `SELECT source FROM namespaces WHERE prefix = ?`, [ns]
    )
    const namespace = rows[0]
    if (!namespace) return null

    if (namespace.source === "deterministic") {
        const asset = await db.select<{ value: string }[]>(
            `SELECT value FROM deterministic_assets WHERE namespace = ? AND key = ?`, [ns, key]
        )
        return asset[0] ? { type: "deterministic", value: asset[0].value } : null
    }

    return { type: "rag", prefix: ns, query: key }
}

export async function getDeterministicKeys(namespace: string): Promise<MentionItem[]> {
    const db = await getDB()
    const rows = await db.select<{ key: string; value: string }[]>(
        `SELECT key, value FROM deterministic_assets WHERE namespace = ? ORDER BY key ASC`, [namespace]
    )
    return rows.map((r) => ({
        id: `${namespace}:${r.key}`,
        label: `${namespace}:${r.key}`,
        excerpt: r.value.slice(0, 120),
        source: "deterministic" as const,
    }))
}

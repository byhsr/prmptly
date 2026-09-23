import { getDB } from "@/lib/db"

export async function claimNamespace(prefix: string, source: "deterministic" | "rag"): Promise<void> {
    const db = await getDB()

    // __global__ is hidden from every scope picker, but deterministic_assets.namespace is a
    // foreign key to namespaces(prefix) — so unscoped snippets still need this row to exist.
    if (prefix === "__global__") {
        const existing = await db.select<{ prefix: string }[]>(
            `SELECT prefix FROM namespaces WHERE prefix = ?`, [prefix]
        )
        if (existing.length === 0) {
            await db.execute(
                `INSERT INTO namespaces (prefix, source, meta_json, created_at) VALUES (?, 'deterministic', '{}', ?)`,
                [prefix, new Date().toISOString()]
            )
        }
        return
    }

    const rows = await db.select<{ source: string }[]>(
        `SELECT source FROM namespaces WHERE prefix = ?`, [prefix]
    )

    if (rows.length > 0 && rows[0].source !== source) {
        throw new Error(`Prefix "${prefix}" is already registered as ${rows[0].source}`)
    }

    if (rows.length === 0) {
        await db.execute(
            `INSERT INTO namespaces (prefix, source, meta_json, created_at) VALUES (?, ?, '{}', ?)`, [prefix, source, new Date().toISOString()]
        )
    }

}






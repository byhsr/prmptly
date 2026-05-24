import { getDB } from "@/lib/db"

export async function claimNamespace(prefix: string, source: "deterministic" | "rag"): Promise<void> {
    const db = await getDB()

    const rows = await db.select<{ source: string }[]>(
        `SELECT source FROM namespaces WHERE prefix = ?`, [prefix]
    )

    if (rows.length > 0 && rows[0].source !== source) {
        throw new Error(`Prefix "${prefix}" is already registered as ${rows[0].source}`)
    }

    if (rows.length === 0) {
        await db.execute(
            `INSERT INTO namespaces (prefix, source) VALUES (?, ?)`, [prefix, source]
        )
    }

}






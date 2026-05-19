import { createFile, readFile, createFolder, deleteFolder } from "../lib/fs/fs.ts"
import { getDB } from "../lib/db/index.ts"
import { getPromptTypeDir, getPrompt, buildFilePath } from "@/lib/fs/fsHelpers.ts"
import { BuilderSectionContent } from "@/lib/db/prompt.ts"

// ── Types ─────────────────────────────────────────────────────────────────────

type CreatePromptInput = {
  name: string
  template_id?: string | null
  collection_id?: string | null
}

type PromptResult = {
  id: string
  name: string
  template_id: string | null
  collection_id: string | null
  version: {
    id: string
    version_number: number
    label: string | null
    builder_content: BuilderSectionContent[]
    scratchpad: string
    output: { text: string | null; json: string | null; xml: string | null }
  }
}

type PromptRow = {
  id: string
  name: string
  template_id: string | null
  collection_id: string | null
  current_version_id: string
  created_at: string
  updated_at: string
}

type PromptVersionRow = {
  id: string
  prompt_id: string
  version_number: number
  label: string | null
  builder_content: string | null
  scratchpad_text_path: string | null
  scratchpad_flow_path: string | null
  output_id: string | null
  created_at: string
}

type OutputRow = {
  id: string
  text: string | null
  json: string | null
  xml: string | null
  created_at: string
}

type UpdatePromptInput = {
  promptId: string
  scratchpad?: string
  output?: { text?: string; json?: string; xml?: string }
  builder_content?: Array<{ sectionId: string; order: number; value: string }>
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createPrompt({
  name,
  template_id = null,
  collection_id = null,
}: CreatePromptInput) {
  const db = await getDB()

  const promptId = crypto.randomUUID()
  const versionId = crypto.randomUUID()
  const outputId = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  const entriesDir = await getPromptTypeDir("entries")
  const promptFolder = await getPrompt("entries", promptId)

  try {
    // ── FS: scratchpad files only ──────────────────────────────────────────
    await createFolder(entriesDir)
    await createFolder(promptFolder)

    const scratchpadTextPath = await buildFilePath(promptFolder, "scratchpad.md")
    const scratchpadFlowPath = await buildFilePath(promptFolder, "scratchpad.excalidraw")

    await createFile(scratchpadTextPath, "")
    await createFile(scratchpadFlowPath, JSON.stringify({ type: "excalidraw", elements: [], appState: {} }))

    // ── DB ─────────────────────────────────────────────────────────────────
    await db.execute(
      `INSERT INTO outputs (id, text, json, xml, created_at) VALUES (?, ?, ?, ?, ?)`,
      [outputId, null, null, null, createdAt]
    )

    await db.execute(
      `INSERT INTO prompts (id, name, template_id, collection_id, current_version_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [promptId, name, template_id, collection_id, versionId, createdAt, createdAt]
    )

    await db.execute(
      `INSERT INTO prompt_versions (id, prompt_id, version_number, label, builder_content, scratchpad_text_path, scratchpad_flow_path, output_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [versionId, promptId, 1, "v1", "[]", scratchpadTextPath, scratchpadFlowPath, outputId, createdAt]
    )

    return { id: promptId, version_id: versionId }
  } catch (err) {
    console.error("createPrompt failed:", err)
    throw err
  }
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function readPrompt(promptId: string): Promise<PromptResult | null> {
  const db = await getDB()

  const promptRows = await db.select<PromptRow[]>(
    `SELECT * FROM prompts WHERE id = ? LIMIT 1`,
    [promptId]
  )
  if (!promptRows.length) return null
  const prompt = promptRows[0]

  const versionRows = await db.select<PromptVersionRow[]>(
    `SELECT * FROM prompt_versions WHERE id = ? LIMIT 1`,
    [prompt.current_version_id]
  )
  if (!versionRows.length) return null
  const version = versionRows[0]

  // builder_content
  let builderContent : BuilderSectionContent[] = []
  try {
    builderContent = JSON.parse(version.builder_content || "[]")
  } catch {
    builderContent = []
  }

  // output from DB
  let output: { id: string | null; text: string | null; json: string | null; xml: string | null } = { id: null, text: null, json: null, xml: null }
  if (version.output_id) {
    const outputRows = await db.select<OutputRow[]>(
      `SELECT * FROM outputs WHERE id = ? LIMIT 1`,
      [version.output_id]
    )
    if (outputRows.length) {
      output = {
        id: outputRows[0].id,
        text: outputRows[0].text,
        json: outputRows[0].json,
        xml: outputRows[0].xml,
      }
    }
  }

  // scratchpad from FS
  let scratchpad = ""
  try {
    const folder = await getPrompt("entries", promptId)
    scratchpad = await readFile(folder, "scratchpad.md")
  } catch {}

  return {
    id: prompt.id,
    name: prompt.name,
    template_id: prompt.template_id,
    collection_id: prompt.collection_id,
    version: {
      id: version.id,
      version_number: version.version_number,
      label: version.label,
      builder_content: builderContent ,
      scratchpad,
      output,
    },
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updatePromptContent({
  promptId,
  scratchpad,
  output,
  builder_content,
}: UpdatePromptInput) {
  const db = await getDB()

  const promptRows = await db.select<{ current_version_id: string }[]>(
    `SELECT current_version_id FROM prompts WHERE id = ? LIMIT 1`,
    [promptId]
  )
  if (!promptRows.length) throw new Error("Prompt not found")

  const versionId = promptRows[0].current_version_id

  const versionRows = await db.select<{ output_id: string | null; scratchpad_text_path: string | null }[]>(
    `SELECT output_id, scratchpad_text_path FROM prompt_versions WHERE id = ? LIMIT 1`,
    [versionId]
  )
  if (!versionRows.length) throw new Error("Version not found")

  const { output_id, scratchpad_text_path } = versionRows[0]

  // builder_content
  if (builder_content) {
    await db.execute(
      `UPDATE prompt_versions SET builder_content = ? WHERE id = ?`,
      [JSON.stringify(builder_content), versionId]
    )
  }

  // output → DB
  if (output && output_id) {
    const fields = Object.entries(output).filter(([, v]) => v !== undefined)
    if (fields.length) {
      const sql = `UPDATE outputs SET ${fields.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`
      await db.execute(sql, [...fields.map(([, v]) => v), output_id])
    }
  }

  // scratchpad → FS
  if (typeof scratchpad === "string" && scratchpad_text_path) {
    await createFile(scratchpad_text_path, scratchpad)
  }

  // update prompt timestamp
  await db.execute(
    `UPDATE prompts SET updated_at = ? WHERE id = ?`,
    [new Date().toISOString(), promptId]
  )

  return { ok: true }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deletePrompt(promptId: string) {
  const db = await getDB()
  const folder = await getPrompt("entries", promptId)
  await db.execute(`DELETE FROM prompts WHERE id = ?`, [promptId])
  try { await deleteFolder(folder) } catch {}
}
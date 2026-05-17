import { getDB } from "./index";

export interface TemplateSection {
  id: string
  template_id: string
  title: string
  placeholder: string | null
  order_index: number
  created_at: string
}


export interface Prompt {
  id: string;
  name: string;
  template_id: string | null;
  collection_id: string | null;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  version_number: number;
  label: string | null;
  builder_content: string | null; // JSON string
  scratchpad_path: string | null;
  output_path: string | null;
  output_type: string | null;
  created_at: string;
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

// export async function 




export interface BuilderSectionContent {
  sectionId: string
  order: number
  value: string
}

export async function saveBuilderContent(
  versionId: string,
  sections: BuilderSectionContent[]
): Promise<void> {
  const db = await getDB()
  await db.execute(
    `UPDATE prompt_versions SET builder_content = ? WHERE id = ?`,
    [JSON.stringify(sections), versionId]
  )
}

export async function saveOutput(
  outputId: string,
  text: string | null,
  json: string | null,
  xml: string | null
): Promise<void> {
  const db = await getDB()
  await db.execute(
    `UPDATE outputs SET text = ?, json = ?, xml = ? WHERE id = ?`,
    [text, json, xml, outputId]
  )
}

export async function updatePromptTemplate(promptId: string, templateId: string): Promise<void> {
  const db = await getDB()
  await db.execute(
    `UPDATE prompts SET template_id = ?, updated_at = ? WHERE id = ?`,
    [templateId, new Date().toISOString(), promptId]
  )
}
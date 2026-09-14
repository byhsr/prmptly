import { save } from "@tauri-apps/plugin-dialog"
import { skillServiceWithFiles } from "@/services/service.skill"
import { writeFile } from "@/lib/fs/fs"

export async function exportSkillToFile(skill: { id: string; name: string }): Promise<boolean> {
  const markdown = await skillServiceWithFiles.export(skill.id)

  const path = await save({
    defaultPath: `${skill.name.replace(/\s+/g, "-").toLowerCase()}.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  })

  if (!path) return false

  await writeFile(path, markdown)
  return true
}

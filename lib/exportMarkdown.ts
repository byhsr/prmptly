import { save } from "@tauri-apps/plugin-dialog"
import { writeFile } from "@/lib/fs/fs"

function slug(name: string): string {
  return name.trim().replace(/\s+/g, "-").toLowerCase() || "prompt"
}

export async function exportMarkdownToFile(name: string, markdown: string): Promise<boolean> {
  const path = await save({
    defaultPath: `${slug(name)}.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  })

  if (!path) return false

  await writeFile(path, markdown)
  return true
}

import { readFile, writeFile } from "@/lib/fs/fs"
import { serializeDoc, nodeToXml } from "../client/textEditorFuncs"
import { DocumentSection, OutputFormat } from "@/lib/types/Document"

export async function readJson<T>(path: string): Promise<T | null> {
  try {
    const text = await readFile(path)
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

export async function writeJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2))
}


export function buildOutput(
  sections: DocumentSection[],
  format: OutputFormat
): string {
  if (!sections.length) return ""

  const ordered = [...sections].sort((a, b) => a.order - b.order)

  const content = ordered.map((section) => ({
    title: section.title,
    key: section.title.toLowerCase().replace(/\s+/g, "_"),
    value: section.doc
      ? serializeDoc(section.doc, format)
      : section.value,
  }))

  if (format === "plain") {
    return content
      .map((s) => `${s.title.toUpperCase()}:\n${s.value}`)
      .join("\n\n")
  }

  if (format === "json") {
    const obj: Record<string, unknown> = {}

    for (const section of content) {
      try {
        const parsed = JSON.parse(section.value)
        obj[section.key] = parsed?.prompt ?? parsed
      } catch {
        obj[section.key] = section.value
      }
    }

    return JSON.stringify(obj, null, 2)
  }

  if (format === "xml") {
    const inner = content
      .map((section) => {
        if (section.doc) {
          return `  <${section.key}>\n${nodeToXml(section.doc, 2)}\n  </${section.key}>`
        }

        const lines = section.value
          .split("\n")
          .map((line) => `    ${line}`)
          .join("\n")

        return `  <${section.key}>\n${lines}\n  </${section.key}>`
      })
      .join("\n")

    return `<prompt>\n${inner}\n</prompt>`
  }

  return ""
}
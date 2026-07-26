import { JSONContent } from "@tiptap/react"

export interface QuickSection {
  id: string
  title: string
  doc: JSONContent
}

// minimal markdown → Tiptap doc (paragraphs + "- " bullets, matches SmartEditor's own shortcut)
function textToDoc(text: string): JSONContent {
  const lines = text.split("\n").filter((l) => l.trim().length > 0)
  const content: JSONContent[] = []
  let bulletBuf: string[] = []

  const flushBullets = () => {
    if (bulletBuf.length) {
      content.push({
        type: "bulletList",
        content: bulletBuf.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: [{ type: "text", text: item }] }],
        })),
      })
      bulletBuf = []
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith("- ")) {
      bulletBuf.push(line.trim().slice(2))
    } else {
      flushBullets()
      content.push({ type: "paragraph", content: [{ type: "text", text: line }] })
    }
  }
  flushBullets()

  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] }
}

export function parseMarkdownSections(raw: string): QuickSection[] {
  const headerRegex = /^##\s+(.+)$/gm
  const hasHeaders = headerRegex.test(raw)

  if (!hasHeaders) {
    return [{ id: crypto.randomUUID(), title: "", doc: textToDoc(raw) }]
  }

  const parts = raw.split(/^##\s+(.+)$/gm).slice(1) // [title, body, title, body, ...]
  const sections: QuickSection[] = []

  for (let i = 0; i < parts.length; i += 2) {
    const title = parts[i].trim()
    const body = (parts[i + 1] || "").trim()
    sections.push({ id: crypto.randomUUID(), title, doc: textToDoc(body) })
  }

  return sections
}
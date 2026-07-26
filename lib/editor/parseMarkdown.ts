import { JSONContent } from "@tiptap/react"

export interface QuickSection {
  id: string
  title: string
  doc: JSONContent | string
}

// ─── Markdown → HTML (covers headings, bold, italic, code, links, lists, blockquotes, rules) ───

function mdToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

  // inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>")
  // bold
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  // italic
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>")
  // links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // split into lines
  const lines = html.split("\n")
  const out: string[] = []
  let inCodeBlock = false
  let inBlockquote = false
  let inList = false
  let inOrdered = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // code block fences
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        out.push("</pre>")
        inCodeBlock = false
      } else {
        out.push("<pre><code>")
        inCodeBlock = true
      }
      continue
    }
    if (inCodeBlock) {
      out.push(line + "\n")
      continue
    }

    // horizontal rule
    if (/^---\s*$/.test(line)) {
      if (inList) { out.push("</ul>"); inList = false }
      if (inOrdered) { out.push("</ol>"); inOrdered = false }
      if (inBlockquote) { out.push("</blockquote>"); inBlockquote = false }
      out.push("<hr />")
      continue
    }

    // blockquote
    if (line.startsWith("> ")) {
      if (!inBlockquote) {
        if (inList) { out.push("</ul>"); inList = false }
        if (inOrdered) { out.push("</ol>"); inOrdered = false }
        out.push("<blockquote>")
        inBlockquote = true
      }
      out.push(`<p>${line.slice(2)}</p>`)
      // if next line isn't a blockquote, close tag
      if (i + 1 >= lines.length || !lines[i + 1].startsWith("> ")) {
        out.push("</blockquote>")
        inBlockquote = false
      }
      continue
    }

    // headings
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/)
    if (hMatch) {
      if (inList) { out.push("</ul>"); inList = false }
      if (inOrdered) { out.push("</ol>"); inOrdered = false }
      const level = hMatch[1].length
      out.push(`<h${level}>${hMatch[2].trim()}</h${level}>`)
      continue
    }

    // ordered list
    const oMatch = line.match(/^\d+\.\s+(.+)$/)
    if (oMatch) {
      if (inList) { out.push("</ul>"); inList = false }
      if (!inOrdered) { out.push("<ol>"); inOrdered = true }
      out.push(`<li>${oMatch[1]}</li>`)
      if (i + 1 >= lines.length || !/^\d+\.\s/.test(lines[i + 1])) {
        out.push("</ol>")
        inOrdered = false
      }
      continue
    }

    // unordered list
    const uMatch = line.match(/^[-*]\s+(.+)$/)
    if (uMatch) {
      if (inOrdered) { out.push("</ol>"); inOrdered = false }
      if (!inList) { out.push("<ul>"); inList = true }
      out.push(`<li>${uMatch[1]}</li>`)
      if (i + 1 >= lines.length || !/^[-*]\s/.test(lines[i + 1])) {
        out.push("</ul>")
        inList = false
      }
      continue
    }

    // empty line — close any open lists
    if (line.trim() === "") {
      if (inList) { out.push("</ul>"); inList = false }
      if (inOrdered) { out.push("</ol>"); inOrdered = false }
      continue
    }

    // paragraph
    if (inList) { out.push("</ul>"); inList = false }
    if (inOrdered) { out.push("</ol>"); inOrdered = false }
    out.push(`<p>${line}</p>`)
  }

  if (inCodeBlock) out.push("</pre>")
  if (inBlockquote) out.push("</blockquote>")
  if (inList) out.push("</ul>")
  if (inOrdered) out.push("</ol>")

  return out.join("\n")
}

export function markdownToDoc(text: string): string {
  return mdToHtml(text)
}

// helper to convert markdown → Tiptap-compatible HTML for setContent
export function markdownToHtml(text: string): string {
  return mdToHtml(text)
}

export function parseMarkdownSections(raw: string): QuickSection[] {
  const headerRegex = /^##\s+(.+)$/gm
  const hasHeaders = headerRegex.test(raw)

  if (!hasHeaders) {
    return [{ id: crypto.randomUUID(), title: "", doc: markdownToDoc(raw) }]
  }

  const parts = raw.split(/^##\s+(.+)$/gm).slice(1)
  const sections: QuickSection[] = []

  for (let i = 0; i < parts.length; i += 2) {
    const title = parts[i].trim()
    const body = (parts[i + 1] || "").trim()
    sections.push({ id: crypto.randomUUID(), title, doc: markdownToDoc(body) })
  }

  return sections
}

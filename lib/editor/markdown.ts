import { Markdown, MarkdownManager } from "@tiptap/markdown"
import StarterKit from "@tiptap/starter-kit"
import type { JSONContent } from "@tiptap/react"

const manager = new MarkdownManager({
  extensions: [StarterKit, Markdown],
})

export function parseMarkdown(markdown: string): JSONContent {
  return manager.parse(markdown)
}

export function toMarkdown(doc: JSONContent): string {
  return manager.serialize(doc)
}

export interface DerivedSection {
  title: string
  nodes: JSONContent[]
}

export function deriveSections(doc: JSONContent): DerivedSection[] {
  const sections: DerivedSection[] = []

  for (const node of doc.content ?? []) {
    if (node.type === "heading" && Number(node.attrs?.level) === 2) {
      sections.push({
        title: (node.content ?? []).map((child) => child.text ?? "").join("").trim(),
        nodes: [],
      })
      continue
    }
    if (!sections.length) sections.push({ title: "", nodes: [] })
    sections[sections.length - 1].nodes.push(node)
  }

  return sections.length ? sections : [{ title: "", nodes: [] }]
}

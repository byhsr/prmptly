import type { JSONContent } from "@tiptap/react"
import { deriveSections, parseMarkdown, type DerivedSection } from "@/lib/editor/markdown"
import { docToCleanJson, nodeToXml } from "@/lib/client/textEditorFuncs"

export type PromptFormat = "markdown" | "json" | "xml"

export interface PromptOutputs {
  markdown: string
  json: string
  xml: string
}

function asDoc(nodes: JSONContent[]): JSONContent {
  return { type: "doc", content: nodes }
}

function jsonFrom(sections: DerivedSection[]): string {
  return JSON.stringify(
    sections.map((s) => ({
      title: s.title || null,
      content: docToCleanJson(asDoc(s.nodes)),
    })),
    null,
    2
  )
}

function xmlFrom(sections: DerivedSection[]): string {
  return sections
    .map((s) => {
      const inner = nodeToXml(asDoc(s.nodes), s.title ? 1 : 0)
      return s.title ? `<${s.title}>\n${inner}\n</${s.title}>` : inner
    })
    .join("\n")
}

// One canonical writer: markdown in, a derived representation out.
// The markdown is the source of truth — json/xml are views over `##` sections.
export function buildOutput(body: string, format: PromptFormat): string {
  if (!body.trim()) return ""
  if (format === "markdown") return body

  const sections = deriveSections(parseMarkdown(body))
  return format === "json" ? jsonFrom(sections) : xmlFrom(sections)
}

export function buildOutputs(body: string): PromptOutputs {
  if (!body.trim()) return { markdown: "", json: "", xml: "" }

  const sections = deriveSections(parseMarkdown(body))
  return { markdown: body, json: jsonFrom(sections), xml: xmlFrom(sections) }
}

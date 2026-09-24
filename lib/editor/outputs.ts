import type { JSONContent } from "@tiptap/react"
import { deriveSections, parseMarkdown, type DerivedSection } from "@/lib/editor/markdown"
import { docToCleanJson, nodeToXml } from "@/lib/client/textEditorFuncs"
import { stripNotes } from "@/lib/editor/notes"

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
// `%% note %%` annotations are the author's own and never reach a compiled output.
export function buildOutput(body: string, format: PromptFormat): string {
  const clean = stripNotes(body)
  if (!clean.trim()) return ""
  if (format === "markdown") return clean

  const sections = deriveSections(parseMarkdown(clean))
  return format === "json" ? jsonFrom(sections) : xmlFrom(sections)
}

export function buildOutputs(body: string): PromptOutputs {
  const clean = stripNotes(body)
  if (!clean.trim()) return { markdown: "", json: "", xml: "" }

  const sections = deriveSections(parseMarkdown(clean))
  return { markdown: clean, json: jsonFrom(sections), xml: xmlFrom(sections) }
}

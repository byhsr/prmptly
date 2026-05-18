"use client"

/**
 * SmartEditor — Tiptap rich text editor
 *
 * npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-mention
 *
 * Usage:
 *   <SmartEditor
 *     value={filledSections[id]}
 *     outputFormat={outputFormat}        // from promptStore
 *     onChange={(plain, doc) => updateSection(id, plain, doc)}
 *     placeholder="Enter content..."
 *   />
 *
 * Shortcuts:
 *   -<space>        → bullet list
 *   Tab             → nest deeper
 *   Shift+Tab       → lift up
 *   @               → mention picker (wire DUMMY_MENTIONS to real DB later)
 */

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { useEffect, useRef, useState, useCallback } from "react"
import type { JSONContent } from "@tiptap/react"

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputFormat = "plain" | "json" | "xml"

export interface SmartEditorProps {
  value?: string
  placeholder?: string
  outputFormat?: OutputFormat
  onChange?: (plain: string, structured: JSONContent) => void
  className?: string
  minHeight?: number
}

// ─── Serializers ──────────────────────────────────────────────────────────────

function nodeToPlain(node: JSONContent, depth = 0): string {
  const indent = "  ".repeat(depth)

  switch (node.type) {
    case "doc":
      return (node.content ?? [])
        .map((n) => nodeToPlain(n, depth))
        .filter(Boolean)
        .join("\n")

    case "paragraph": {
      const text = (node.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
      return text ? `${indent}${text}` : ""
    }

    case "bulletList":
      return (node.content ?? []).map((n) => nodeToPlain(n, depth)).join("\n")

    case "listItem": {
      const lines: string[] = []
      for (const part of node.content ?? []) {
        if (part.type === "paragraph") {
          const text = (part.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
          lines.push(`${indent}- ${text}`)
        } else {
          // nested list
          lines.push(nodeToPlain(part, depth + 1))
        }
      }
      return lines.join("\n")
    }

    case "text":
      return node.text ?? ""

    case "mention":
      return `@${node.attrs?.id ?? ""}`

    default:
      return (node.content ?? []).map((n) => nodeToPlain(n, depth)).join("")
  }
}

function docToCleanJson(node: JSONContent): unknown {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(docToCleanJson).filter(Boolean)

    case "paragraph": {
      const text = (node.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
      return text || null
    }

    case "bulletList":
      return { list: (node.content ?? []).map(docToCleanJson).filter(Boolean) }

    case "listItem": {
      const parts = node.content ?? []
      const para = parts.find((p) => p.type === "paragraph")
      const nested = parts.find((p) => p.type === "bulletList")
      const text = (para?.content ?? []).map((n) => nodeToPlain(n, 0)).join("")
      return nested
        ? { item: text, children: docToCleanJson(nested) }
        : { item: text }
    }

    case "mention":
      return `@${node.attrs?.id ?? ""}`

    default:
      return null
  }
}


function nodeToXml(node: JSONContent, depth = 0): string {
  const indent = "  ".repeat(depth)

  switch (node.type) {
    case "doc":
      return (node.content ?? [])
        .map((n) => nodeToXml(n, depth))
        .filter(Boolean)
        .join("\n")

    case "paragraph": {
      const text = (node.content ?? []).map((n) => nodeToXml(n, 0)).join("")
      return text ? `${indent}<p>${text}</p>` : ""
    }

    case "bulletList": {
      const inner = (node.content ?? []).map((n) => nodeToXml(n, depth + 1)).join("\n")
      return `${indent}<list>\n${inner}\n${indent}</list>`
    }

    case "listItem": {
      const parts: string[] = []
      for (const part of node.content ?? []) {
        if (part.type === "paragraph") {
          const text = (part.content ?? []).map((n) => nodeToXml(n, 0)).join("")
          parts.push(`${indent}  <item>${text}</item>`)
        } else {
          parts.push(nodeToXml(part, depth + 1))
        }
      }
      return parts.join("\n")
    }

    case "text":
      return node.text ?? ""

    case "mention":
      return `<mention id="${node.attrs?.id ?? ""}" />`

    default:
      return (node.content ?? []).map((n) => nodeToXml(n, 0)).join("")
  }
}

export function serializeDoc(doc: JSONContent, format: OutputFormat): string {
  switch (format) {
    case "plain":
      return nodeToPlain(doc)

    case "json":
      return JSON.stringify(docToCleanJson(doc), null, 2)

    case "xml":
      // no wrapper here — compile adds the section tag around it
      return nodeToXml(doc, 0)
  }
}

// ─── @mention dropdown ────────────────────────────────────────────────────────

// Replace with real DB query later — same shape { id, label }
const DUMMY_MENTIONS = [
  { id: "writer:tone", label: "@writer:tone" },
  { id: "writer:style", label: "@writer:style" },
  { id: "project:scope", label: "@project:scope" },
  { id: "project:context", label: "@project:context" },
  { id: "kb:persona", label: "@kb:persona" },
  { id: "kb:rules", label: "@kb:rules" },
]

interface MentionListProps {
  items: typeof DUMMY_MENTIONS
  command: (item: { id: string }) => void
  onClose: () => void
}

function MentionList({ items, command, onClose }: MentionListProps) {
  const [selected, setSelected] = useState(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => (s + 1) % items.length) }
      else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => (s - 1 + items.length) % items.length) }
      else if (e.key === "Enter") { e.preventDefault(); command(items[selected]) }
      else if (e.key === "Escape") { onClose() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [items, selected, command, onClose])

  if (!items.length) return null

  return (
    <div className="min-w-[180px] rounded-lg border border-border bg-background shadow-lg overflow-hidden">
      {items.map((item, i) => (
        <button
          key={item.id}
          onMouseDown={(e) => { e.preventDefault(); command(item) }}
          className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${
            i === selected ? "bg-foreground/10 text-foreground" : "text-muted hover:bg-foreground/5"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── SmartEditor ──────────────────────────────────────────────────────────────

export function SmartEditor({
  value,
  placeholder = "Write here… use - for bullets, Tab to nest, @ to reference",
  outputFormat = "plain",
  onChange,
  className = "",
  minHeight = 120,
}: SmartEditorProps) {
  const [mentionState, setMentionState] = useState<{
    show: boolean
    query: string
    pos: { top: number; left: number }
    command: ((item: { id: string }) => void) | null
  }>({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          items: ({ query }) =>
            DUMMY_MENTIONS.filter((m) =>
              m.id.toLowerCase().includes(query.toLowerCase())
            ),
          render: () => ({
            onStart: (props) => {
              const rect = props.clientRect?.()
              if (!rect) return
              setMentionState({
                show: true,
                query: props.query,
                pos: { top: rect.bottom + 6, left: rect.left },
                command: props.command,
              })
            },
            onUpdate: (props) => {
              const rect = props.clientRect?.()
              if (!rect) return
              setMentionState((s) => ({
                ...s,
                query: props.query,
                pos: { top: rect.bottom + 6, left: rect.left },
                command: props.command,
              }))
            },
            onKeyDown: (props) => props.event.key === "Escape",
            onExit: () =>
              setMentionState({ show: false, query: "", pos: { top: 0, left: 0 }, command: null }),
          }),
        },
      }),
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "smart-editor-content focus:outline-none",
        style: `min-height: ${minHeight}px`,
      },
    },
    onUpdate({ editor }) {
      const doc = editor.getJSON()
      onChange?.(nodeToPlain(doc), doc)
    },
  })

  // Tab / Shift+Tab for list nesting
  useEffect(() => {
    if (!editor) return
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !editor.isFocused) return
      e.preventDefault()
      if (e.shiftKey) {
        editor.chain().focus().liftListItem("listItem").run()
      } else {
        editor.chain().focus().sinkListItem("listItem").run()
      }
    }
    window.addEventListener("keydown", handleTab, true)
    return () => window.removeEventListener("keydown", handleTab, true)
  }, [editor])

  // Sync when external value changes (e.g. loading a saved prompt)
  useEffect(() => {
    if (!editor || value === undefined) return
    const current = nodeToPlain(editor.getJSON())
    if (current !== value) editor.commands.setContent(value || "", { emitUpdate: false })
  }, [value]) // eslint-disable-line

  const handleMentionCommand = useCallback(
    (item: { id: string }) => {
      mentionState.command?.(item)
      setMentionState({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })
    },
    [mentionState]
  )

  return (
    <>
      <div
        className={`smart-editor-wrapper relative w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors focus-within:border-foreground/30 ${className}`}
      >
        <EditorContent editor={editor} />
      </div>

      {/* @mention portal */}
      {mentionState.show && (
        <div
          style={{
            position: "fixed",
            top: mentionState.pos.top,
            left: mentionState.pos.left,
            zIndex: 9999,
          }}
        >
          <MentionList
            items={DUMMY_MENTIONS.filter((m) =>
              m.id.toLowerCase().includes(mentionState.query.toLowerCase())
            )}
            command={handleMentionCommand}
            onClose={() =>
              setMentionState({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })
            }
          />
        </div>
      )}

      {/* Styles — move to global CSS if preferred */}
      <style>{`
        .smart-editor-content p {
          margin: 0;
          line-height: 1.6;
        }
        .smart-editor-content p + p {
          margin-top: 0.25rem;
        }
        .smart-editor-content ul {
          padding-left: 1.25rem;
          list-style: none;
          margin: 0.25rem 0;
        }
        .smart-editor-content ul li {
          position: relative;
          margin: 0.125rem 0;
        }
        .smart-editor-content ul li::before {
          content: "–";
          position: absolute;
          left: -1.1rem;
          color: var(--color-muted, #666);
        }
        .smart-editor-content ul ul {
          margin-top: 0.125rem;
        }
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--color-muted, #888);
          opacity: 0.5;
          pointer-events: none;
          height: 0;
        }
        .mention {
          background: var(--color-border, #333);
          border-radius: 4px;
          padding: 0 4px;
          font-family: monospace;
          font-size: 0.8em;
          cursor: default;
        }
      `}</style>
    </>
  )
}
import { useRef } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import type { JSONContent } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { nodeToPlain } from "@/lib/client/textEditorFuncs"
import { getNamespaces, resolveMention, type Namespace } from "@/services/contextInjection"
import "@/src/styles/TextEditor.css"

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputFormat = "plain" | "json" | "xml"

export interface SmartEditorProps {
    value?: string
    placeholder?: string
    outputFormat?: OutputFormat
    onChange?: (plain: string, structured: JSONContent) => void
    onResolvedContext?: (key: string, value: string) => void
    className?: string
    minHeight?: number
}

interface MentionItem {
    id: string
    label: string
    source: "deterministic" | "rag"
}

interface MentionListProps {
    items: MentionItem[]
    command: (item: MentionItem) => void
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

    if (!items.length) return (
    <div className="min-w-[180px] rounded-lg border border-border bg-background shadow-lg px-3 py-2">
        <p className="text-xs text-muted">No context yet add data to Snippet or Context to inject</p>
    </div>
)

    return (
        <div className="min-w-[180px] rounded-lg border border-border bg-background shadow-lg overflow-hidden">
            {items.map((item, i) => (
                <button
                    key={item.id}
                    onMouseDown={(e) => { e.preventDefault(); command(item) }}
                    className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${i === selected ? "bg-foreground/10 text-foreground" : "text-muted hover:bg-foreground/5"}`}
                >
                    <span>{item.label}</span>
                    <span className="ml-2 opacity-40 text-[10px]">{item.source}</span>
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
    onResolvedContext,
    className = "",
    minHeight = 20,
}: SmartEditorProps) {
    const [namespaces, setNamespaces] = useState<Namespace[]>([])
    const namespacesRef = useRef<Namespace[]>([])

    const [mentionState, setMentionState] = useState<{
        show: boolean
        query: string
        pos: { top: number; left: number }
        command: ((item: { id: string }) => void) | null
    }>({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })

    useEffect(() => {
        getNamespaces().then((ns) => {
            setNamespaces(ns)
            namespacesRef.current = ns
        })
    }, [])

    const getFilteredItems = useCallback((query: string): MentionItem[] => {
        return namespacesRef.current
            .filter((ns) => ns.prefix.toLowerCase().includes(query.toLowerCase()))
            .map((ns) => ({ id: ns.prefix, label: `@${ns.prefix}`, source: ns.source }))
    }, [])

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
        namespacesRef.current
            .filter((ns) => ns.prefix.toLowerCase().includes(query.toLowerCase()))
            .map((ns) => ({ id: ns.prefix, label: `@${ns.prefix}`, source: ns.source })),
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

    useEffect(() => {
        if (!editor || value === undefined) return
        const current = nodeToPlain(editor.getJSON())
        if (current !== value) editor.commands.setContent(value || "", { emitUpdate: false })
    }, [value]) // eslint-disable-line

    const handleMentionCommand = useCallback(
        async (item: MentionItem) => {
            mentionState.command?.(item)
            setMentionState({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })

            if (item.source === "deterministic") {
                const result = await resolveMention(item.id)
                if (result?.type === "deterministic") {
                    onResolvedContext?.(item.id, result.value)
                }
            }
            // rag — stays as mention node, resolved at generation time
        },
        [mentionState, onResolvedContext]
    )

    return (
        <>
            <div
                className={cn(`smart-editor-wrapper relative w-full rounded-lg
                      px-3 py-2 text-sm text-foreground transition-colors focus-within:border-foreground/30 ${className}`)}
            >
                <EditorContent editor={editor} />
            </div>

            {mentionState.show && createPortal(
                <div
                    style={{
                        position: "fixed",
                        top: mentionState.pos.top,
                        left: mentionState.pos.left,
                        zIndex: 9999,
                    }}
                >
                    <MentionList
                        items={getFilteredItems(mentionState.query)}
                        command={handleMentionCommand}
                        onClose={() =>
                            setMentionState({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })
                        }
                    />
                </div>,
                document.body
            )}
        </>
    )
}
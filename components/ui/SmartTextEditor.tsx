import { useRef, useState, useEffect, useCallback } from "react"
import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { Node, mergeAttributes } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { createPortal } from "react-dom"
import type { JSONContent } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { nodeToPlain } from "@/lib/client/textEditorFuncs"
import { getNamespaces, type Namespace } from "@/services/contextInjection"
import "@/src/styles/TextEditor.css"

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputFormat = "plain" | "json" | "xml"
export type ChipStatus = "pending" | "resolved" | "empty"


export interface SmartEditorProps {
    value?: string
    placeholder?: string
    outputFormat?: OutputFormat
    onChange?: (plain: string, structured: JSONContent) => void
    onResolvedContext?: (key: string, value: string) => void
    className?: string
    minHeight?: number
}

export interface MentionItem {
    id: string
    label: string
    source: "deterministic" | "rag"
    excerpt?: string
    value?: string
}
type MentionStage = "namespace" | "key" | "rag-query"

interface MentionStateType {
    show: boolean
    query: string
    pos: { top: number; left: number }
    command: ((item: { id: string }) => void) | null
    stage: MentionStage
    selectedNamespace: { prefix: string; source: "deterministic" | "rag" } | null
    subItems: MentionItem[]
    mentionFrom?: number  // doc position where @ was typed
}

const RESET_MENTION: MentionStateType = {
    show: false, query: "", pos: { top: 0, left: 0 },
    command: null, stage: "namespace", selectedNamespace: null, subItems: [],
}

// ─── Context Chip Node ────────────────────────────────────────────────────────
// Custom Tiptap node that holds source, key, query, status, and resolved content

interface ChipNodeAttrs {
    id: string
    label: string
    source: "deterministic" | "rag"
    query: string          // for RAG: text after colon
    status: ChipStatus
    resolvedContent: string
}

function ChipNodeView({ node }: { node: any }) {
    const attrs = node.attrs as ChipNodeAttrs
    const [popoverOpen, setPopoverOpen] = useState(false)
    const [anchorPos, setAnchorPos] = useState({ top: 0, left: 0 })
    const chipRef = useRef<HTMLSpanElement>(null)

    const handleClick = () => {
        if (attrs.status !== "resolved") return
        const rect = chipRef.current?.getBoundingClientRect()
        if (!rect) return
        setAnchorPos({ top: rect.bottom + 6, left: rect.left })
        setPopoverOpen((v) => !v)
    }

    const statusColor = {
        pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
        resolved: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 cursor-pointer hover:bg-emerald-500/30",
        empty: "bg-red-500/20 text-red-300 border-red-500/30",
    }[attrs.status]

    return (
        <NodeViewWrapper as="span" className="inline">
            <span
                ref={chipRef}
                contentEditable={false}
                onClick={handleClick}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono border mx-0.5 transition-colors select-none ${statusColor}`}
            >
                <span>{attrs.label}</span>
                {attrs.status === "pending" && <span className="animate-pulse">…</span>}
                {attrs.status === "empty" && <span className="opacity-60">∅</span>}
                {attrs.status === "resolved" && <span className="opacity-60">↗</span>}
            </span>

            {popoverOpen && createPortal(
                <div
                    style={{ position: "fixed", top: anchorPos.top, left: anchorPos.left, zIndex: 9999 }}
                    className="max-w-sm rounded-lg border border-border bg-background shadow-xl p-3"
                >
                    <p className="text-[10px] text-muted font-mono mb-1">{attrs.id}</p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{attrs.resolvedContent}</p>
                    <button
                        onMouseDown={(e) => { e.preventDefault(); setPopoverOpen(false) }}
                        className="mt-2 text-[10px] text-muted hover:text-foreground transition-colors"
                    >
                        close
                    </button>
                </div>,
                document.body
            )}
        </NodeViewWrapper>
    )
}

const ContextChipNode = Node.create({
    name: "contextChip",
    group: "inline",
    inline: true,
    atom: true,

    addAttributes() {
        return {
            id: { default: "" },
            label: { default: "" },
            source: { default: "deterministic" },
            query: { default: "" },
            status: { default: "pending" },
            resolvedContent: { default: "" },
        }
    },

    parseHTML() {
        return [{ tag: 'span[data-context-chip]' }]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-context-chip': '' })]
    },

    addNodeView() {
        return ReactNodeViewRenderer(ChipNodeView)
    },
})

// ─── MentionList ──────────────────────────────────────────────────────────────

interface MentionListProps {
    items: MentionItem[]
    command: (item: MentionItem) => void
    onClose: () => void
    stage: MentionStage
    ragQuery: string
    onRagQueryChange: (q: string) => void
    onRagCommit: () => void
}

function MentionList({ items, command, onClose, stage, ragQuery, onRagQueryChange, onRagCommit }: MentionListProps) {
    const [selected, setSelected] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setSelected(0)
    }, [items])

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (stage === "rag-query") {
                if (e.key === "Enter") { e.preventDefault(); onRagCommit() }
                else if (e.key === "Escape") { onClose() }
                return
            }
            if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => (s + 1) % items.length) }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => (s - 1 + items.length) % items.length) }
            else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); if (items[selected]) command(items[selected]) }
            else if (e.key === "Escape") { onClose() }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [items, selected, command, onClose, stage, onRagCommit])

    useEffect(() => {
        const el = listRef.current?.children[selected] as HTMLElement | undefined
        el?.scrollIntoView({ block: "nearest" })
    }, [selected])

    if (stage === "rag-query") {
        return (
            <div className="min-w-[260px] rounded-lg border border-border bg-background shadow-lg overflow-hidden">
                <p className="px-3 pt-2 text-[10px] text-muted font-mono">query this scope</p>
                <input
                    autoFocus
                    value={ragQuery}
                    onChange={(e) => onRagQueryChange(e.target.value)}
                    placeholder="e.g. frontend styles…"
                    className="w-full px-3 py-2 text-xs font-mono bg-transparent text-foreground outline-none border-t border-border mt-1"
                />
                <p className="px-3 pb-2 text-[10px] text-muted">Enter to search · Esc to cancel</p>
            </div>
        )
    }

    if (!items.length) return (
        <div className="min-w-[220px] rounded-lg border border-border bg-background shadow-lg px-3 py-2">
            <p className="text-xs text-muted">No snippets for this namespace yet</p>
        </div>
    )

    return (
        <div ref={listRef} className="min-w-[240px] max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-lg">
            {items.map((item, i) => (
                <button
                    key={item.id}
                    onMouseDown={(e) => { e.preventDefault(); command(item) }}
                    onMouseEnter={() => setSelected(i)}
                    className={`w-full px-3 py-2 text-left transition-colors border-b border-border/40 last:border-0 ${i === selected ? "bg-foreground/10" : "hover:bg-foreground/5"}`}
                >
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-foreground font-medium">{item.label}</span>
                    </div>
                    {item.excerpt && (
                        <p className="text-[11px] text-muted mt-0.5 leading-relaxed line-clamp-2 font-sans">
                            {item.excerpt}
                            {item.excerpt.length >= 120 ? "…" : ""}
                        </p>
                    )}
                </button>
            ))}
        </div>
    )
}

// ─── SmartEditor ──────────────────────────────────────────────────────────────

export function SmartEditor({
    value,
    placeholder = "Write here… use - for bullets, Tab to nest, @ to reference",
    onChange,
    onResolvedContext,
    className = "",
    minHeight = 20,
}: SmartEditorProps) {
    const namespacesRef = useRef<Namespace[]>([])
    const snippetsRef = useRef<MentionItem[]>([])
    const [mentionState, setMentionState] = useState<MentionStateType & { ragQuery: string }>(
        { ...RESET_MENTION, ragQuery: "" }
    )

    useEffect(() => {
        getNamespaces().then((ns) => { namespacesRef.current = ns })
    }, [])

    useEffect(() => {
        // Load all snippets into the ref for real-time search
        import("@/lib/db/library").then(({ libraryService }) =>
            libraryService.getAll().then((snippets) => {
                snippetsRef.current = snippets.map((s) => ({
                    id: s.key,
                    label: s.key,
                    value: s.value,
                    source: "deterministic" as const,
                    excerpt: s.value.slice(0, 120),
                }))
            })
        )
    }, [])

    const resetMention = useCallback(() =>
        setMentionState({ ...RESET_MENTION, ragQuery: "" }), [])

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                bulletList: { keepMarks: true, keepAttributes: false },
            }),
            Placeholder.configure({
                placeholder,
                emptyEditorClass: "is-editor-empty",
            }),
            ContextChipNode,
            Mention.configure({
                HTMLAttributes: { class: "" },
                renderLabel: () => "",
                suggestion: {
                    items: ({ query }) => {
                        // Show all snippet keys as flat list, filtered by query
                        return snippetsRef.current
                            .filter((s) => s.label.toLowerCase().includes(query.toLowerCase()))
                            .slice(0, 50)
                    },
                    render: () => ({
                        onStart: (props) => {
                            const rect = props.clientRect?.()
                            if (!rect) return
                            // Capture the cursor position where @ was typed
                            const { state } = editor!.view
                            const mentionFrom = state.selection.from - 1  // the @ char
                            setMentionState((s) => ({
                                ...s,
                                show: true,
                                query: props.query,
                                pos: { top: rect.bottom + 6, left: rect.left },
                                command: props.command,
                                stage: "namespace",
                                subItems: [],
                                selectedNamespace: null,
                                mentionFrom,
                            }))
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
                        onExit: () => resetMention(),
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
            // Let Tiptap's built-in mention command delete the @key text first
            mentionState.command?.({ id: item.id })
            resetMention()
            if (item.value && editor) {
                // Replace the just-inserted mention node with the resolved snippet content
                const { state, dispatch } = editor.view
                state.doc.descendants((node, pos) => {
                    if (node.type.name === "mention" && node.attrs.id === item.id) {
                        dispatch(state.tr.replaceWith(pos, pos + node.nodeSize, state.schema.text(item.value!)))
                        return false
                    }
                })
                onResolvedContext?.(item.id, item.value)
            }
        },
        [mentionState, editor, resetMention]
    )

    const handleRagCommit = useCallback(() => {}, [])

    const visibleItems: MentionItem[] =
        snippetsRef.current
            .filter((s) => s.label.toLowerCase().includes(mentionState.query.toLowerCase()))
            .slice(0, 50)

    return (
        <>
            <div className={cn(`smart-editor-wrapper relative w-full rounded-lg px-3 py-2 text-sm text-foreground transition-colors focus-within:border-foreground/30 ${className}`)}>
                <EditorContent editor={editor} />
            </div>

            {mentionState.show && createPortal(
                <div style={{ position: "fixed", top: mentionState.pos.top, left: mentionState.pos.left, zIndex: 9999 }}>
                    <MentionList
                        items={visibleItems}
                        command={handleMentionCommand}
                        onClose={resetMention}
                        stage={mentionState.stage as any}
                        ragQuery={mentionState.ragQuery}
                        onRagQueryChange={(q) => setMentionState((s) => ({ ...s, ragQuery: q }))}
                        onRagCommit={handleRagCommit}
                    />
                </div>,
                document.body
            )}
        </>
    )
}
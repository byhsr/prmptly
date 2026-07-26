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
import { getNamespaces, resolveMention, getDeterministicKeys, type Namespace } from "@/services/contextInjection"
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

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (stage === "rag-query") {
                if (e.key === "Enter") { e.preventDefault(); onRagCommit() }
                else if (e.key === "Escape") { onClose() }
                return
            }
            if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => (s + 1) % items.length) }
            else if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => (s - 1 + items.length) % items.length) }
            else if (e.key === "Enter") { e.preventDefault(); if (items[selected]) command(items[selected]) }
            else if (e.key === "Escape") { onClose() }
        }
        window.addEventListener("keydown", handler)
        return () => window.removeEventListener("keydown", handler)
    }, [items, selected, command, onClose, stage, onRagCommit])

    if (stage === "rag-query") {
        return (
            <div className="min-w-[220px] rounded-lg border border-border bg-background shadow-lg overflow-hidden">
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
        <div className="min-w-[180px] rounded-lg border border-border bg-background shadow-lg px-3 py-2">
            <p className="text-xs text-muted">No context yet — add data to Snippet or Context to inject</p>
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
    onChange,
    onResolvedContext,
    className = "",
    minHeight = 20,
}: SmartEditorProps) {
    const namespacesRef = useRef<Namespace[]>([])
    const [mentionState, setMentionState] = useState<MentionStateType & { ragQuery: string }>(
        { ...RESET_MENTION, ragQuery: "" }
    )

    useEffect(() => {
        getNamespaces().then((ns) => { namespacesRef.current = ns })
    }, [])

    const resetMention = useCallback(() =>
        setMentionState({ ...RESET_MENTION, ragQuery: "" }), [])

    // Insert a context chip into the editor and kick off resolution
    const insertChip = useCallback((
        editorInstance: ReturnType<typeof useEditor>,
        item: MentionItem,
        ragQuery = ""
    ) => {
        if (!editorInstance) return

        const chipId = item.source === "deterministic" ? item.id : `${item.id}:${ragQuery}`
        const label = item.source === "deterministic" ? `@${item.id}` : `@${item.id}`

        editorInstance.chain().focus().insertContent({
            type: "contextChip",
            attrs: {
                id: chipId,
                label,
                source: item.source,
                query: ragQuery,
                status: "pending",
                resolvedContent: "",
            },
        }).run()

        // Resolve immediately after insert
        if (item.source === "deterministic") {
            resolveMention(item.id).then((result) => {
                if (result?.type === "deterministic") {
                    // Find and update the chip node
                    const { state, dispatch } = editorInstance.view
                    state.doc.descendants((node, pos) => {
                        if (node.type.name === "contextChip" && node.attrs.id === chipId) {
                            const tr = state.tr.setNodeMarkup(pos, undefined, {
                                ...node.attrs,
                                status: "resolved",
                                resolvedContent: result.value,
                            })
                            dispatch(tr)
                            onResolvedContext?.(chipId, result.value)
                        }
                    })
                } else {
                    // mark empty
                    const { state, dispatch } = editorInstance.view
                    state.doc.descendants((node, pos) => {
                        if (node.type.name === "contextChip" && node.attrs.id === chipId) {
                            dispatch(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, status: "empty" }))
                        }
                    })
                }
            })
        } else {
            // RAG — vector search stub, wire your invoke here
            // invoke("vector_search", { scope: item.id, query: ragQuery }).then(chunks => { ... })
            // For now mark pending → you'll resolve this when backend is ready
        }
    }, [onResolvedContext])

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
                            setMentionState((s) => ({
                                ...s,
                                show: true,
                                query: props.query,
                                pos: { top: rect.bottom + 6, left: rect.left },
                                command: props.command,
                                stage: "namespace",
                                subItems: [],
                                selectedNamespace: null,
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
            if (mentionState.stage === "namespace") {
                if (item.source === "deterministic") {
                    const keys = await getDeterministicKeys(item.id)
                    setMentionState((s) => ({
                        ...s,
                        stage: "key",
                        selectedNamespace: { prefix: item.id, source: "deterministic" },
                        subItems: keys,
                        query: "",
                    }))
                } else {
                    // RAG — cancel the default mention, show query input
                    mentionState.command?.({ id: "\x00" }) // dismiss tiptap mention
                    setMentionState((s) => ({ ...s, stage: "rag-query" as any, selectedNamespace: { prefix: item.id, source: "rag" } }))
                }
                return
            }

            if (mentionState.stage === "key") {
                // deterministic final key selected — dismiss tiptap mention, insert chip
                mentionState.command?.({ id: "\x00" })
                resetMention()
                insertChip(editor, item)
                return
            }
        },
        [mentionState, editor, insertChip, resetMention]
    )

    const handleRagCommit = useCallback(() => {
        if (!mentionState.selectedNamespace || !mentionState.ragQuery.trim()) return
        const item: MentionItem = {
            id: mentionState.selectedNamespace.prefix,
            label: `@${mentionState.selectedNamespace.prefix}`,
            source: "rag",
        }
        resetMention()
        insertChip(editor, item, mentionState.ragQuery.trim())
    }, [mentionState, editor, insertChip, resetMention])

    const visibleItems: MentionItem[] =
        mentionState.stage === "key"
            ? mentionState.subItems.filter((i) => i.label.toLowerCase().includes(mentionState.query.toLowerCase()))
            : namespacesRef.current
                .filter((ns) => ns.prefix.toLowerCase().includes(mentionState.query.toLowerCase()))
                .map((ns) => ({ id: ns.prefix, label: `@${ns.prefix}`, source: ns.source }))

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
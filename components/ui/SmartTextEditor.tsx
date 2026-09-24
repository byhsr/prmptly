import { useRef, useState, useEffect, useCallback } from "react"
import { useEditor, useEditorState, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { Node, mergeAttributes, type Editor } from "@tiptap/core"
import { Bold, Code, Heading1, Heading2, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react"
import { Tooltip } from "@/components/ui/Tooltip"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { Markdown } from "@tiptap/markdown"
import { TableKit } from "@tiptap/extension-table"
import { Fragment } from "@tiptap/pm/model"
import { createPortal } from "react-dom"
import type { JSONContent } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { nodeToPlain } from "@/lib/client/textEditorFuncs"
import { parseMarkdown } from "@/lib/editor/markdown"
import { NoteDecoration } from "@/lib/editor/noteDecoration"
import { getNamespaces, type Namespace } from "@/services/contextInjection"
import "@/src/styles/TextEditor.css"

// ─── Types ────────────────────────────────────────────────────────────────────

export type OutputFormat = "plain" | "json" | "xml"
export type ChipStatus = "pending" | "resolved" | "empty"


export interface SmartEditorProps {
    initialContent?: string | JSONContent
    placeholder?: string
    outputFormat?: OutputFormat
    contentType?: "markdown" | "html" | "json"
    onChange?: (plain: string, structured: JSONContent, markdown: string) => void
    onResolvedContext?: (key: string, value: string) => void
    onEditorReady?: (editor: any) => void
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

// ─── Selection Toolbar ────────────────────────────────────────────────────────
// Format bar that rides above a text selection. Styled in the app's surface/border
// grammar and appended to <body> with a fixed strategy, so a scrolling editor can
// never clip it.

function SelectionToolbar({ editor }: { editor: Editor }) {
    const active = useEditorState({
        editor,
        selector: ({ editor }) => ({
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            code: editor.isActive("code"),
            h1: editor.isActive("heading", { level: 1 }),
            h2: editor.isActive("heading", { level: 2 }),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            blockquote: editor.isActive("blockquote"),
        }),
    })

    const items = [
        { label: "Bold", icon: Bold, on: active.bold, run: () => editor.chain().focus().toggleBold().run() },
        { label: "Italic", icon: Italic, on: active.italic, run: () => editor.chain().focus().toggleItalic().run() },
        { label: "Strikethrough", icon: Strikethrough, on: active.strike, run: () => editor.chain().focus().toggleStrike().run() },
        { label: "Inline code", icon: Code, on: active.code, run: () => editor.chain().focus().toggleCode().run() },
        { label: "Heading 1", icon: Heading1, on: active.h1, run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
        { label: "Heading 2", icon: Heading2, on: active.h2, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: "Bullet list", icon: List, on: active.bulletList, run: () => editor.chain().focus().toggleBulletList().run() },
        { label: "Numbered list", icon: ListOrdered, on: active.orderedList, run: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "Quote", icon: Quote, on: active.blockquote, run: () => editor.chain().focus().toggleBlockquote().run() },
    ]

    return (
        <div className="flex items-center gap-0.5">
            {items.map(({ label, icon: Icon, on, run }) => (
                <Tooltip key={label} label={label} side="top">
                    <button
                        type="button"
                        aria-label={label}
                        aria-pressed={on}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={run}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${on ? "bg-accent/20 text-foreground" : "text-muted hover:bg-background hover:text-foreground"}`}
                    >
                        <Icon size={13} aria-hidden="true" />
                    </button>
                </Tooltip>
            ))}
        </div>
    )
}

// ─── SmartEditor ──────────────────────────────────────────────────────────────

export function SmartEditor({
    initialContent,
    placeholder = "Write here… use - for bullets, Tab to nest, @ to reference",
    contentType,
    onChange,
    onResolvedContext,
    onEditorReady,
    className = "",
    minHeight = 20,
}: SmartEditorProps) {
    const namespacesRef = useRef<Namespace[]>([])
    const snippetsRef = useRef<MentionItem[]>([])
    const [mentionState, setMentionState] = useState<MentionStateType & { ragQuery: string }>(
        { ...RESET_MENTION, ragQuery: "" }
    )
    const markdownMode = contentType === "markdown" && typeof initialContent === "string"

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
            TableKit,
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
            Markdown,
            NoteDecoration,
        ],
        content: initialContent || "",
        contentType: markdownMode ? "markdown" : undefined,
        editorProps: {
            attributes: {
                class: "smart-editor-content focus:outline-none",
                style: `min-height: ${minHeight}px`,
            },
            handlePaste: (view, event) => {
                if (contentType !== "markdown") return false
                const text = event.clipboardData?.getData("text/plain")
                if (!text) return false
                const nodes = parseMarkdown(text).content
                if (!nodes?.length) return false

                const { state } = view
                let fragment: Fragment
                try {
                    fragment = Fragment.fromArray(nodes.map((node) => state.schema.nodeFromJSON(node)))
                } catch {
                    return false
                }

                event.preventDefault()
                const { from, to } = state.selection
                const { parent } = state.doc.resolve(from)
                const isEmptyTextBlock = parent.isTextblock && !parent.type.spec.code && !parent.childCount
                view.dispatch(
                    state.tr.replaceWith(
                        isEmptyTextBlock ? Math.max(0, from - 1) : from,
                        isEmptyTextBlock ? to + 1 : to,
                        fragment
                    )
                )
                return true
            },
        },
        onUpdate({ editor }) {
            const doc = editor.getJSON()
            onChange?.(nodeToPlain(doc), doc, editor.getMarkdown())
        },
    })

    // Expose editor instance to parent
    useEffect(() => {
        if (editor && onEditorReady) {
            onEditorReady(editor)
        }
    }, [editor, onEditorReady])

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
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        updateDelay={100}
                        appendTo={() => document.body}
                        options={{ strategy: "fixed", placement: "top", offset: 8, flip: true, shift: { padding: 8 } }}
                        className="z-[9999] flex items-center gap-0.5 rounded-xl border border-border bg-surface px-1.5 py-1 shadow-lg"
                    >
                        <SelectionToolbar editor={editor} />
                    </BubbleMenu>
                )}
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
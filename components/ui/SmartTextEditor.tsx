
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Mention from "@tiptap/extension-mention"
import { useEffect,  useState, useCallback } from "react"
import type { JSONContent } from "@tiptap/react"
import { cn } from "@/lib/utils"
import { nodeToPlain } from "@/lib/client/textEditorFuncs"
import "@/src/styles/TextEditor.css"
import { createPortal } from "react-dom"

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
                    className={`w-full px-3 py-1.5 text-left text-xs font-mono transition-colors ${i === selected ? "bg-foreground/10 text-foreground" : "text-muted hover:bg-foreground/5"
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
    minHeight = 20,
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
                className={cn(`smart-editor-wrapper relative w-full rounded-lg
                      px-3 py-2 text-sm text-foreground transition-colors focus-within:border-foreground/30 ${className}`)}
            >
                <EditorContent editor={editor} />
            </div>

            {/* @mention portal */}
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
                        items={DUMMY_MENTIONS.filter((m) =>
                            m.id.toLowerCase().includes(mentionState.query.toLowerCase())
                        )}
                        command={handleMentionCommand}
                        onClose={() =>
                            setMentionState({ show: false, query: "", pos: { top: 0, left: 0 }, command: null })
                        }
                    />
                </div>, document.body 
            )}
        </>
    )
}
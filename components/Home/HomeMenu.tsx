import { useCallback, useEffect, useState } from "react"
import { motion } from "framer-motion"
import { BookOpen, File, FilePlus, FileText, Settings2 } from "lucide-react"
import { listDocuments, getDocument } from "@/lib/db/document"
import type { Document } from "@/lib/types/Document"
import { useQuicksStore } from "@/hooks/store/quickStore"
import { useTabViewStore } from "@/hooks/store/TabStore"
import { createPrompt } from "@/services/service.prompt"

const MAX_RECENTS = 8

function displayName(doc: Document): string {
  if (doc.name && doc.name !== "Untitled Quick") return doc.name
  const text = doc.sections?.[0]?.value
  return (typeof text === "string" && text.slice(0, 60).replace(/\n.*/, "")) || "Untitled"
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function openQuick(id: string) {
  return getDocument(id).then((full) => {
    if (!full) return
    useQuicksStore.getState().loadEntry({
      id: full.id,
      name: full.name,
      body: full.sections?.[0]?.value ?? "",
      output: null,
      createdAt: Date.now(),
    })
    useTabViewStore.getState().setActiveView("home")
  })
}

async function newPrompt() {
  const result = await createPrompt({ name: "untitled" })
  const store = useTabViewStore.getState()
  store.addTab({ id: result.id, label: "Untitled Prompt", type: "prompt" })
  store.setActiveView("prompt")
  // Refresh the prompt tree in the sidebar
  window.dispatchEvent(new CustomEvent("quick-saved"))
}

const ACTIONS = [
  {
    label: "New quick",
    hint: "paste-ready markdown",
    icon: FilePlus,
    run: () => {
      useQuicksStore.getState().reset()
      useQuicksStore.setState({ name: "Untitled Quick", hasContent: true })
      useTabViewStore.getState().setActiveView("home")
    },
  },
  { label: "New prompt", hint: "structured & templated", icon: FileText, run: newPrompt },
  {
    label: "Library",
    hint: "templates, snippets, skills",
    icon: BookOpen,
    run: () => useTabViewStore.getState().setActiveView("library"),
  },
  {
    label: "Settings",
    hint: "themes, fonts, models",
    icon: Settings2,
    run: () => useTabViewStore.getState().setIsSettingsOpen(true),
  },
]

export function HomeMenu() {
  const [recents, setRecents] = useState<Document[]>([])

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments()
      setRecents(docs.slice(0, MAX_RECENTS))
    } catch (err) {
      console.error("Failed to load recents:", err)
    }
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("quick-saved", handler)
    return () => window.removeEventListener("quick-saved", handler)
  }, [refresh])

  const openRecent = (doc: Document) => {
    if (doc.type === "quick") openQuick(doc.id)
    else {
      const store = useTabViewStore.getState()
      store.addTab({ id: doc.id, label: doc.name, type: "prompt" })
      store.setActiveView("prompt")
    }
  }

  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      <div className="flex flex-col gap-10 px-10 py-12 w-full">
        <header className="flex flex-col gap-1">
          <h1 className="text-base font-semibold text-foreground">quicks</h1>
          <p className="text-sm text-muted">
            Start something new, or jump back into recent work.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
            Quick actions
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {ACTIONS.map(({ label, hint, icon: Icon, run }) => (
              <motion.button
                key={label}
                onClick={run}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 500, damping: 24 }}
                className="focus-ring group flex flex-col items-start gap-1 rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-background"
              >
                <Icon size={14} className="text-muted group-hover:text-foreground transition-colors" aria-hidden="true" />
                <span className="text-xs text-foreground">{label}</span>
                <span className="font-mono text-[10px] text-muted">{hint}</span>
              </motion.button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
            Recents
          </span>
          {recents.length === 0 ? (
            <p className="text-xs text-muted">Nothing yet — create a quick to get going.</p>
          ) : (
            <div className="flex flex-col">
              {recents.map((doc) => (
                <motion.button
                  key={doc.id}
                  onClick={() => openRecent(doc)}
                  whileTap={{ scale: 0.99 }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface"
                >
                  <File size={13} className="shrink-0 opacity-50" aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate text-xs text-foreground">
                    {displayName(doc)}
                  </span>
                  <span className="shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted">
                    {doc.type}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted w-16 text-right">
                    {relativeTime(doc.updatedAt)}
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback } from "react"
import { motion } from "framer-motion"
import { Columns2, Columns3, LayoutPanelTop, PenLine, StickyNote, Terminal, Workflow, Search, ListTree, Brain } from "lucide-react"
import { BuilderPanel} from "./BuilderPanel"
import { ScratchpadPanel } from "./scratchpadPanel"
import { PromptPanel } from "./GeneratedPromptPanel"
import { Canvas } from "../canvas/Canvas"
import { OutlinePanel } from "./OutlinePanel"
import { RectifyBar } from "./RectifyBar"
import { AIAssistant } from "../ai/AIAssistant"
import { Tab } from "../core-components/Tabbar"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { Template } from "@/lib/db/template"
import { TemplateSelector } from "./TemplateSelector"
import { CanvasFlow } from "@/lib/types/canvas.types"
import { activeEditorRef } from "./BuilderPanel"
import { documentNameOverrides } from "@/lib/state"
import { Tooltip } from "@/components/ui/Tooltip"
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels"


type SubTab = "builder" | "scratchpad" | "prompt" | "canvas"
type SplitMode = "none" | "two" | "two-prompt" | "three"

const SUB_TABS = [
  { id: "builder" as SubTab, icon: PenLine, label: "Builder" },
  { id: "scratchpad" as SubTab, icon: StickyNote, label: "Scratchpad" },
  { id: "canvas" as SubTab, icon: Workflow, label: "Canvas" },
  { id: "prompt" as SubTab, icon: Terminal, label: "Prompt" },
]

export function FileTab({ tab }: { tab: Tab }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("builder")
  const [splitMode, setSplitMode] = useState<SplitMode>("none")
  const { loadDocument, reset, activeDocument, updateTemplate, clearTemplate, persist } = usePromptStore()
  const compiledOutput = usePromptStore((s) => s.compiledOutput)
  const sections = usePromptStore((s) => s.sections)
  const filledSections = usePromptStore((s) => s.filledSections)
  const filledSectionDocs = usePromptStore((s) => s.filledSectionDocs)
  const canvasFlow = usePromptStore((s) => s.canvasFlow)
  const updateCanvas = usePromptStore((s) => s.updateCanvas)
  const [docName, setDocName] = useState(tab.label)
  const [showRectify, setShowRectify] = useState(false)
  const [showOutline, setShowOutline] = useState(false)
  const [showAI, setShowAI] = useState(false)
  // Each split mode keeps its own pane proportions, the same mechanism the
  // sidebar/workspace layout uses.
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    groupId: `filetab-split-${splitMode}`,
    storage: localStorage,
  })

  const outlineSections = Array.isArray(sections) && sections.length > 0
    ? sections.map((s) => ({
        title: s?.title || "",
        doc: filledSectionDocs[s.id] ?? null,
        value: filledSections[s.id] ?? "",
      }))
    : undefined

  useEffect(() => {
    loadDocument(tab.id)
    setDocName(tab.label)
    return () => { activeEditorRef.current = null; reset() }
  }, [tab.id])

  const handleNameChange = useCallback(async (newName: string) => {
    setDocName(newName)
    documentNameOverrides.set(tab.id, newName)
    const { updateDocument } = await import("@/lib/db/document")
    await updateDocument(tab.id, { name: newName })
    const { useTabViewStore } = await import("@/hooks/store/TabStore")
    const state = useTabViewStore.getState()
    useTabViewStore.setState({
      tabs: state.tabs.map((t) => t.id === tab.id ? { ...t, label: newName } : t),
    })
  }, [tab.id])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        persist()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault()
        setShowRectify((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [persist])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault()
        setShowOutline((v) => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const cycleSplitMode = () => {
    const modes: SplitMode[] = ["none", "two", "two-prompt", "three"]
    const currentIndex = modes.indexOf(splitMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setSplitMode(modes[nextIndex])
  }

  const getSplitIcon = () => {
    switch (splitMode) {
      case "none":
        return <LayoutPanelTop className="h-3.5 w-3.5" />
      case "two":
        return <Columns2 className="h-3.5 w-3.5" />
      case "two-prompt":
        return <Columns2 className="h-3.5 w-3.5" />
      case "three":
        return <Columns3 className="h-3.5 w-3.5" />
    }
  }

  const renderPanel = (panel: SubTab) => {
    switch (panel) {
      case "builder":
        return <BuilderPanel />
      case "scratchpad":
        return <ScratchpadPanel />
      case "canvas":
        return (
          <Canvas
            key={tab.id}
            initialFlow={canvasFlow}
            onChange={updateCanvas}
          />
        )
      case "prompt":
        return <PromptPanel />
    }
  }

  const getPanelsToShow = (): SubTab[] => {
    switch (splitMode) {
      case "none":
        return [activeSubTab]
      case "two":
        return ["builder", "scratchpad"]
      case "two-prompt":
        return ["builder", "prompt"]
      case "three":
        return ["builder", "scratchpad", "prompt"]
    }
  }

  const panelsToShow = getPanelsToShow()
  const showTemplate = panelsToShow.includes("builder")

  const handleTemplateChange = (template: Template | null) => {
    if (!template) {
      clearTemplate()
      return
    }
    updateTemplate(template.id)
  }

  return (
    <div className="flex relative h-full w-full flex-col">
      <div className="w-full sticky top-0 flex flex-col bg-surface z-40">
        <div className="flex justify-between">
          <div className="w-fit flex-1 flex items-center px-6">
            <input
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onBlur={() => handleNameChange(docName)}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur() }}
              className="bg-transparent min-w-full outline-none text-sm font-medium tracking-wide"
            />
          </div>

          <div className="flex">
            <div className="z-50 flex items-center justify-center">
              {showTemplate && (
                <TemplateSelector
                  value={activeDocument?.templateId ?? null}
                  onChange={handleTemplateChange}
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-1 px-4 pt-2">
              <Tooltip label="Outline">
                <motion.button
                  onClick={() => setShowOutline((v) => !v)}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className={`rounded-lg p-2 transition-colors ${showOutline ? "bg-background text-foreground" : "text-muted hover:text-foreground hover:bg-background"}`}
                >
                  <ListTree className="h-3.5 w-3.5" />
                </motion.button>
              </Tooltip>

              <Tooltip label="Find & Replace">
                <motion.button
                  onClick={() => setShowRectify((v) => !v)}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className={`rounded-lg p-2 transition-colors ${showRectify ? "bg-background text-foreground" : "text-muted hover:text-foreground hover:bg-background"}`}
                >
                  <Search className="h-3.5 w-3.5" />
                </motion.button>
              </Tooltip>

              <div className="flex items-center gap-1">
                {SUB_TABS.map(({ id, icon: Icon, label }) => (
                  <Tooltip key={id} label={label}>
                    <motion.button
                      onClick={() => setActiveSubTab(id)}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                      className={`rounded-lg p-2 transition-colors duration-150 ${activeSubTab === id ? "bg-background text-foreground" : "text-muted hover:text-foreground hover:bg-background"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </motion.button>
                  </Tooltip>
                ))}
              </div>

              <Tooltip label="AI Assistant">
                <motion.button
                  onClick={() => setShowAI((v) => !v)}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className={`rounded-lg p-2 transition-colors ${showAI ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground hover:bg-background"}`}
                >
                  <Brain className="h-3.5 w-3.5" />
                </motion.button>
              </Tooltip>

              <Tooltip
                label={
                  splitMode === "none" ? "Split view" : splitMode === "two" ? "Builder + Prompt" : splitMode === "two-prompt" ? "Builder + Scratchpad" : "Show all three"
                }
              >
                <motion.button
                  onClick={cycleSplitMode}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className={`rounded-lg p-2 transition-colors ${splitMode !== "none" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground hover:bg-background"}`}
                >
                  {getSplitIcon()}
                </motion.button>
              </Tooltip>
            </div>
          </div>
        </div>

        {showRectify && (
          <RectifyBar editorRef={activeEditorRef} onClose={() => setShowRectify(false)} />
        )}
      </div>

      <div className="flex-1 w-full overflow-hidden">
        <div className="flex h-full w-full">
          <div className={`flex h-full ${showOutline ? "flex-1 min-w-0" : "w-full"}`}>
            {panelsToShow.length > 1 ? (
              <Group
                defaultLayout={defaultLayout}
                onLayoutChanged={onLayoutChanged}
                orientation="horizontal"
              >
                {panelsToShow.flatMap((panel, index) => [
                  index > 0 ? (
                    <Separator
                      key={`sep-${panel}`}
                      className="bg-border transition-colors hover:bg-foreground/40"
                      style={{ cursor: "col-resize" }}
                    />
                  ) : null,
                  <Panel key={panel} id={panel} minSize={15}>
                    <div className="h-full overflow-y-auto overflow-x-hidden">{renderPanel(panel)}</div>
                  </Panel>,
                ])}
              </Group>
            ) : (
              <div className="h-full w-full overflow-y-auto overflow-x-hidden">
                {panelsToShow.map((panel) => renderPanel(panel))}
              </div>
            )}
          </div>
          {showOutline && (
            <div className="w-56 border-l border-border overflow-y-auto shrink-0">
              <OutlinePanel doc={compiledOutput} sections={outlineSections} />
            </div>
          )}
        </div>
      </div>

      {showAI && (
        <AIAssistant
          onClose={() => setShowAI(false)}
          editorContent={compiledOutput || sections?.map((s: any) => typeof s === "string" ? s : "").join("\n") || ""}
          documentTitle={docName}
          documentType={tab.type}
          canvasContext={canvasFlow.nodes.length > 0 ? formatCanvasForAgent(canvasFlow) : undefined}
          scratchpad={usePromptStore.getState().scratchpadText || undefined}
          templateSections={sections?.length > 0 ? sections.map((s: any) => ({ title: s.title || "", content: (typeof s === "object" && s?.content_json) || "" })) : undefined}
        />
      )}
    </div>
  )
}

/** Format a CanvasFlow into a textual description for the AI */
function formatCanvasForAgent(flow: CanvasFlow): string {
  const parts: string[] = []
  parts.push(`Nodes (${flow.nodes.length}):`)
  for (const n of flow.nodes) {
    let desc = `  [${n.type.toUpperCase()}] "${n.label}"`
    if (n.detail) desc += ` — ${n.detail.slice(0, 150)}`
    if (n.config) {
      if ("model" in (n.config as any) && (n.config as any).model) desc += ` | model: ${(n.config as any).model}`
      if ("actionType" in (n.config as any) && (n.config as any).actionType) desc += ` | action: ${(n.config as any).actionType}`
      if ("operator" in (n.config as any) && (n.config as any).operator) desc += ` | ${(n.config as any).operator} ${(n.config as any).field || ""}`
    }
    parts.push(desc)
  }
  parts.push(`Edges (${flow.edges.length}):`)
  for (const e of flow.edges) {
    parts.push(`  ${e.source} → ${e.target}${e.label ? ` [${e.label}]` : ""}`)
  }
  return parts.join("\n")
}

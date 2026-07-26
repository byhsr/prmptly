import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Columns2, Columns3, LayoutPanelTop, PenLine, StickyNote, Terminal, Workflow } from "lucide-react"
import { BuilderPanel} from "./BuilderPanel"
import { ScratchpadPanel } from "./scratchpadPanel"
import { PromptPanel } from "./GeneratedPromptPanel"
import { Canvas } from "../canvas/Canvas"
import { Tab } from "../core-components/Tabbar"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { Template } from "@/lib/db/template"
import { TemplateSelector } from "./TemplateSelector"
import { CanvasFlow } from "@/lib/types/canvas.types"


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
  const { loadDocument, reset, activeDocument, updateTemplate, clearTemplate } = usePromptStore()
  const [canvasFlow, setCanvasFlow] = useState<CanvasFlow>({ nodes: [], edges: [] })

  useEffect(() => {
    loadDocument(tab.id)
    return () => reset()
  }, [tab.id])

  const cycleSplitMode = () => {
    const modes: SplitMode[] = ["none", "two", "two-prompt", "three"]
    const currentIndex = modes.indexOf(splitMode)
    const nextIndex = (currentIndex + 1) % modes.length
    setSplitMode(modes[nextIndex])
  }

  const getSplitIcon = () => {
    switch (splitMode) {
      case "none":
        return <LayoutPanelTop className="h-4 w-4" />
      case "two":
        return <Columns2 className="h-4 w-4" />
      case "two-prompt":
        return <Columns2 className="h-4 w-4" />
      case "three":
        return <Columns3 className="h-4 w-4" />
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
            initialFlow={canvasFlow}
            onChange={setCanvasFlow}
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
      <div className="w-full sticky top-0 flex justify-between bg-surface z-40">
        {/* tab Title */}
        <div className="w-fit flex-1 flex items-center px-6">
          <input
            defaultValue={tab.label}
            onBlur={() => {}}
            className="bg-transparent min-w-full outline-none text-sm font-medium tracking-wide"
          />
        </div>

        {/* controls */}
        <div className="flex">
          {/* template selector */}
          <div className="z-50 flex items-center justify-center">
            {showTemplate && (
              <TemplateSelector
                value={activeDocument?.templateId ?? null}
                onChange={handleTemplateChange}
              />
            )}
          </div>

          {/* panel selector */}
          <div className="flex items-center justify-end gap-4 px-4 pt-2">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1">
              {SUB_TABS.map(({ id, icon: Icon, label }) => (
                <div key={id} className="relative group">
                  <motion.button
                    onClick={() => setActiveSubTab(id)}
                    whileTap={{ scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className={`rounded-lg p-2 transition-colors duration-150 ${
                      activeSubTab === id
                        ? "bg-background text-foreground"
                        : "text-muted hover:text-foreground hover:bg-background"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </motion.button>
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* Split Button */}
            <motion.button
              onClick={cycleSplitMode}
              whileTap={{ scale: 0.88 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className={`rounded-lg p-2 transition-colors ${
                splitMode !== "none"
                  ? "bg-accent text-accent-foreground"
                  : "text-muted hover:text-foreground hover:bg-background"
              }`}
              title={
                splitMode === "none" ? "Split view" :
                splitMode === "two" ? "Builder + Prompt" :
                splitMode === "two-prompt" ? "Builder + Scratchpad" :
                "Show all three"
              }
            >
              {getSplitIcon()}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 w-full overflow-hidden">
        <motion.div className={`flex h-full w-full ${panelsToShow.length > 1 ? "flex-row" : ""}`} layout>
            {panelsToShow.map((panel, index) => (
              <motion.div
                key={panel}
                layout
                initial={false}
                animate={{ opacity: 1 }}
                className={`h-full overflow-hidden ${
                  index > 0 ? "border-l border-border" : ""
                } ${panelsToShow.length > 1 ? "flex-1 min-w-0" : "min-w-full"}`}
              >
                <div className="h-full overflow-y-auto">
                  {renderPanel(panel)}
                </div>
              </motion.div>
            ))}
        </motion.div>
      </div>
    </div>
  )
}

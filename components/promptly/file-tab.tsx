"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Columns2, Columns3 } from "lucide-react"
import { BuilderPanel } from "./builder-panel"
import { ScratchpadPanel } from "./scratchpad-panel"
import { PromptPanel } from "./prompt-panel"
import { Tab } from "./Tabbar"
import { usePromptStore } from "@/hooks/store/PromptStore"
import { Template } from "@/lib/db/template"
import { TemplateSelector } from "../Prompt/TemplateSelector"

type SubTab = "builder" | "scratchpad" | "prompt"
type SplitMode = "none" | "two" | "two-prompt" | "three"

interface FileTabProps {
  filename: string
}

export function FileTab({ tab }: { tab: Tab }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("builder")
  const [splitMode, setSplitMode] = useState<SplitMode>("none")
  const { loadPrompt, reset, activePrompt, updateTemplate, clearTemplate } = usePromptStore()


  useEffect(() => {
    loadPrompt(tab.id)
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
        return <Columns2 className="h-4 w-4" />
      case "two":
      case "two-prompt":
        return <Columns3 className="h-4 w-4" />
      case "three":
        return <Columns2 className="h-4 w-4 " />
    }
  }

  const renderPanel = (panel: SubTab) => {

    switch (panel) {
      case "builder":
        return <BuilderPanel />
      case "scratchpad":
        return <ScratchpadPanel />
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
      console.log("clearing template")
      clearTemplate()
      return
    }
    updateTemplate(template.id)
  }

  return (
    <div className="flex relative h-full w-full flex-col">
      <div className="w-full  flex justify-between w-f bg-surface">
        {/* tab Title */}
        <div
          className="w-fit flex-1 flex items-center px-6 "

        >
          <input
            defaultValue={tab.label}
            onBlur={() => { }}
            className="bg-transparent  min-w-full outline-none text-sm font-medium tracking-wide"
          />
        </div>



        <div className="flex">
          {/* template selector */}
          <div className=" relative z-50 flex items-center justify-center">
            {showTemplate && <TemplateSelector
              value={activePrompt?.template_id ?? null}
              onChange={handleTemplateChange}
            />}
          </div>


          {/* panel selector */}
          <div className="flex flex-2 items-center justify-end gap-4   px-4 pt-2">
            {/* Tab Switcher */}
            <div className="flex items-center gap-1">
              {(["builder", "scratchpad", "prompt"] as SubTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveSubTab(tab)}
                  className={`rounded-lg rounded-b-none px-4 py-2 text-sm font-medium capitalize transition-colors ${activeSubTab === tab
                    ? "bg-background border-background border-b-2 text-foreground"
                    : "text-main hover:text-foreground hover:bg-background"
                    }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Split Button */}
            <button
              onClick={cycleSplitMode}
              className={`rounded-lg p-2 transition-colors ${splitMode !== "none"
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:text-foreground hover:bg-background"
                }`}
              title="Toggle split view"
            >
              {getSplitIcon()}
            </button>
          </div>
        </div>


      </div>
      {/* Panel Content */}
      <div className="flex-1 overflow-hidden">
        <motion.div
          className="flex h-full "
          layout
        >
          <AnimatePresence mode="popLayout">
            {panelsToShow.map((panel, index) => (
              <motion.div
                key={panel}
                layout
                initial={{ opacity: 0, width: 0 }}
                animate={{
                  opacity: 1,
                  width: `${100 / panelsToShow.length}%`
                }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className={`h-full overflow-hidden ${index > 0 ? "border-l border-border" : ""
                  }`}
              >
                <div className="h-full overflow-y-auto">
                  {renderPanel(panel)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

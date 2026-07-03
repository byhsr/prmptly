import { motion, AnimatePresence } from "framer-motion"
import { Tab } from "./Tabbar"
import { LibraryView } from "../library/LibraryView"
import { ViewType } from "@/lib/types/DashTypes"
import { HomeView, PromptView } from "../Home/HomeView"
import { TemplateView } from "../template/TemplateView"



// ── Props ─────────────────────────────────────────────────────────────────────
interface WorkspaceProps {
  activeView: ViewType
  tabs: Tab[]
  activeTab: Tab | undefined
  onTabSelect: (id: string) => void
  onTabClose: (id: string) => void
  onMarkDirty: (id: string, dirty: boolean) => void
}

// ── Workspace — pure view router ──────────────────────────────────────────────
export function Workspace({ activeTab, activeView }: WorkspaceProps) {

  function renderView(view: ViewType) {
    if (view === "home") return <HomeView />
    if (view === "prompt") {
  return activeTab ? <PromptView tab={activeTab} /> : (
    <div className="w-full h-full flex flex-col justify-center items-center gap-2">
      <span style={{ fontSize: 13 }} className="text-muted">open a prompt from the sidebar</span>
    </div>
  )
}
    if (view === "template") return <TemplateView />
    if (view === "library") return <LibraryView />
  }

  return (
    <div className="flex h-full flex-1 overflow-y-auto" style={{ background: "var(--color-background, #0a0a0a)" }}>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="h-full w-full"
        >
          {renderView(activeView)}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
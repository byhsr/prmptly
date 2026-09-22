import { useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Blocks, Layout, SquareAsterisk, Workflow } from "lucide-react"
import { SkillsPanel } from "./SkillsPanel"
import { SnippetsPanel } from "./SnippetsPanel"
import { TemplateForm } from "../template/TemplateView"
import { SkillGraph } from "../graph/SkillGraph"
import { Select } from "../ui/Select"
import { TabButton } from "../ui/TabButton"
import { useSkillStore, type LibraryTab } from "@/hooks/store/skillStore"
import { useTemplateStore } from "@/hooks/store/templateStore"

const TABS: { id: LibraryTab; icon: typeof Blocks; label: string }[] = [
  { id: "templates", icon: Layout, label: "Templates" },
  { id: "snippets", icon: SquareAsterisk, label: "Snippets" },
  { id: "skills", icon: Blocks, label: "Skills" },
  { id: "graph", icon: Workflow, label: "Graph" },
]

export const LibraryView = () => {
  const libraryTab = useSkillStore((s) => s.libraryTab)
  const setLibraryTab = useSkillStore((s) => s.setLibraryTab)
  const loadSkills = useSkillStore((s) => s.load)
  const loadTemplates = useTemplateStore((s) => s.loadTemplates)

  useEffect(() => {
    loadSkills()
    loadTemplates()
  }, [])

  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="flex bg-surface px-4 items-end justify-between">
        <div className="flex gap-0">
          {TABS.map(({ id, icon: Icon, label }) => (
            <TabButton
              key={id}
              isActive={libraryTab === id}
              onClick={() => setLibraryTab(id)}
              width={120}
              collapsedWidth={120}
              className="flex items-center justify-center gap-2 px-4"
            >
              <Icon style={{ width: 13, height: 13, flexShrink: 0 }} />
              <span>{label}</span>
            </TabButton>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {libraryTab === "templates" && <TemplatesPanel />}
        {libraryTab === "snippets" && <SnippetsPanel />}
        {libraryTab === "skills" && <SkillsPanel />}
        {libraryTab === "graph" && <GraphPanel />}
      </div>
    </div>
  )
}

const TemplatesPanel = () => {
  const selectedTemplateId = useTemplateStore((s) => s.selectedTemplateId)

  return (
    <div className="h-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedTemplateId ?? "new"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="h-full flex justify-start px-20"
        >
          <TemplateForm />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

const GraphPanel = () => {
  const groups = useSkillStore((s) => s.groups)
  const graphScopeId = useSkillStore((s) => s.graphScopeId)
  const setGraphScope = useSkillStore((s) => s.setGraphScope)

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
        <span className="text-[11px] text-muted">graph view</span>
        <Select
          value={graphScopeId ?? ""}
          onChange={(value) => setGraphScope(value || null)}
          size="sm"
          placeholder="Global"
          panelWidth={200}
          className="min-w-[140px]"
          options={[
            { value: "", label: "Global" },
            ...groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
        />
      </div>
      <div className="flex-1 min-h-0">
        <SkillGraph />
      </div>
    </div>
  )
}

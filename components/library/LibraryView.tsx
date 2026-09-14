import { useEffect } from "react"
import { Blocks, Workflow } from "lucide-react"
import { SkillsPanel } from "./SkillsPanel"
import { SkillGraph } from "../graph/SkillGraph"
import { Select } from "../ui/Select"
import { TabButton } from "../ui/TabButton"
import { useSkillStore, type LibraryPanelTab } from "@/hooks/store/skillStore"

const TABS: { id: LibraryPanelTab; icon: typeof Blocks; label: string }[] = [
  { id: "skills", icon: Blocks, label: "Skills" },
  { id: "graph", icon: Workflow, label: "Graph" },
]

export const LibraryView = () => {
  const libraryTab = useSkillStore((s) => s.libraryTab)
  const setLibraryTab = useSkillStore((s) => s.setLibraryTab)
  const loadSkills = useSkillStore((s) => s.load)

  useEffect(() => {
    loadSkills()
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
        {libraryTab === "skills" && <SkillsPanel />}
        {libraryTab === "graph" && <GraphPanel />}
      </div>
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

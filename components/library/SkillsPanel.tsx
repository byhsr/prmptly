import { useEffect, useState } from "react"
import { Blocks, Plus, Upload } from "lucide-react"
import { open } from "@tauri-apps/plugin-dialog"
import { SkillGroupTree } from "./SkillGroupTree"
import { SkillModal } from "./SkillModal"
import { Button } from "../ui/Button"
import { ContextMenu } from "../ui/ContextMenu"
import { useSkillStore } from "@/hooks/store/skillStore"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { skillServiceWithFiles } from "@/services/service.skill"
import { exportSkillToFile } from "@/lib/skillExport"
import { readFile } from "@/lib/fs/fs"
import { Skill } from "@/lib/types/skill"
import { cn } from "@/lib/utils"

export const SkillsPanel = () => {
  const skills = useSkillStore((s) => s.skills)
  const groups = useSkillStore((s) => s.groups)
  const selectedGroupId = useSkillStore((s) => s.selectedGroupId)
  const selectedSkillId = useSkillStore((s) => s.selectedSkillId)
  const isCreatingSkill = useSkillStore((s) => s.isCreatingSkill)
  const setCreatingSkill = useSkillStore((s) => s.setCreatingSkill)
  const selectSkill = useSkillStore((s) => s.selectSkill)
  const load = useSkillStore((s) => s.load)
  const { notify } = useNotifications()

  useEffect(() => {
    load()
  }, [])

  const selectedSkill = skills.find((s) => s.id === selectedSkillId) ?? null
  const visible = selectedGroupId
    ? skills.filter((s) => s.groupId === selectedGroupId)
    : skills

  const closeEditor = () => {
    selectSkill(null)
    setCreatingSkill(false)
  }

  const handleImport = async () => {
    const path = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    })
    if (!path || typeof path !== "string") return
    try {
      const text = await readFile(path)
      await skillServiceWithFiles.import(text, selectedGroupId ?? null)
      await load()
      notify("skill imported")
    } catch {
      notify("failed to import skill", true)
    }
  }

  return (
    <div className="w-full h-full flex">
      <div className="w-56 border-r border-border shrink-0">
        <SkillGroupTree />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {isCreatingSkill || selectedSkill ? (
          <SkillModal
            key={selectedSkill?.id ?? "new"}
            skill={selectedSkill ?? undefined}
            isCreating={isCreatingSkill}
            onClose={closeEditor}
          />
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
              <span className="text-[11px] text-muted">
                {visible.length} skill{visible.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleImport}>
                  <Upload size={11} /> import
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setCreatingSkill(true)}>
                  <Plus size={11} /> new skill
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
              {visible.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 text-muted">
                  <Blocks style={{ width: 24, height: 24 }} strokeWidth={1} />
                  <span style={{ fontSize: 12 }}>no skills yet</span>
                </div>
              ) : (
                visible.map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    groupName={groups.find((g) => g.id === skill.groupId)?.name ?? null}
                    onSelect={() => selectSkill(skill.id)}
                    onExport={async () => {
                      try {
                        const exported = await exportSkillToFile(skill)
                        if (exported) notify("skill exported")
                      } catch {
                        notify("failed to export skill", true)
                      }
                    }}
                    onDelete={async () => {
                      if (!window.confirm(`Delete skill "${skill.name}"?`)) return
                      try {
                        await useSkillStore.getState().deleteSkill(skill.id)
                        notify("skill deleted")
                      } catch {
                        notify("failed to delete skill", true)
                      }
                    }}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const SkillRow = ({
  skill,
  groupName,
  onSelect,
  onExport,
  onDelete,
}: {
  skill: Skill
  groupName: string | null
  onSelect: () => void
  onExport: () => void
  onDelete: () => void
}) => {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)

  return (
    <div
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
      className={cn(
        "flex items-start gap-3 rounded-md border border-transparent px-3 py-2 cursor-pointer transition-colors duration-100",
        "hover:bg-surface/50 hover:border-border"
      )}
    >
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "Edit", onClick: onSelect },
            { label: "Export", onClick: onExport },
            { label: "Delete", onClick: onDelete, danger: true },
          ]}
        />
      )}

      <Blocks size={12} className="shrink-0 mt-0.5" style={{ color: "var(--color-accent)" }} />

      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-mono truncate">{skill.name}</span>
          {groupName && <span className="text-[10px] text-muted shrink-0">· {groupName}</span>}
          {skill.templateId && <span className="text-[10px] text-muted shrink-0">· template</span>}
        </div>
        {skill.description && (
          <span className="text-[11px] text-muted truncate">{skill.description}</span>
        )}
      </div>
    </div>
  )
}

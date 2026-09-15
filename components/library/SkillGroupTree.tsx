import { useEffect, useState } from "react"
import { Blocks, Check, ChevronDown, ChevronRight, Folder, FolderOpen, Plus, X } from "lucide-react"
import { useSkillStore } from "@/hooks/store/skillStore"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { Skill, SkillGroupNode } from "@/lib/types/skill"
import { cn } from "@/lib/utils"
import { ContextMenu } from "../ui/ContextMenu"
import { InlineInput } from "../ui/InlineInput"

function countSkills(node: SkillGroupNode): number {
  return (
    node.skills.length +
    node.children.reduce((total, child) => total + countSkills(child), 0)
  )
}

export const SkillGroupTree = () => {
  const tree = useSkillStore((s) => s.tree)
  const skills = useSkillStore((s) => s.skills)
  const selectedGroupId = useSkillStore((s) => s.selectedGroupId)
  const selectedSkillId = useSkillStore((s) => s.selectedSkillId)
  const selectGroup = useSkillStore((s) => s.selectGroup)
  const selectSkill = useSkillStore((s) => s.selectSkill)
  const setLibraryTab = useSkillStore((s) => s.setLibraryTab)
  const createGroup = useSkillStore((s) => s.createGroup)
  const renameGroup = useSkillStore((s) => s.renameGroup)
  const deleteGroup = useSkillStore((s) => s.deleteGroup)
  const { notify } = useNotifications()

  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [creatingParent, setCreatingParent] = useState<string | null | undefined>(undefined)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [menu, setMenu] = useState<{ x: number; y: number; groupId: string } | null>(null)

  const ungrouped = skills.filter((skill) => !skill.groupId)

  // Expand everything once the tree first loads so skills are visible
  useEffect(() => {
    setExpanded((prev) => {
      if (prev.size > 0) return prev
      const ids = new Set<string>()
      const collect = (nodes: SkillGroupNode[]) =>
        nodes.forEach((node) => { ids.add(node.id); collect(node.children) })
      collect(tree)
      return ids
    })
  }, [tree])

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const startCreate = (parentId: string | null) => {
    setEditingId(null)
    setCreatingParent(parentId)
  }

  const commitCreate = async (name: string) => {
    const parentId = creatingParent ?? null
    setCreatingParent(undefined)
    try {
      await createGroup(name, parentId)
      if (parentId) setExpanded((prev) => new Set(prev).add(parentId))
      notify("group created")
    } catch {
      notify("failed to create group", true)
    }
  }

  const commitRename = async (id: string) => {
    const name = editName.trim()
    setEditingId(null)
    if (!name) return
    try {
      await renameGroup(id, name)
      notify("group renamed")
    } catch {
      notify("failed to rename group", true)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this group? Its skills stay in the library.")) return
    try {
      await deleteGroup(id, true)
      notify("group deleted")
    } catch {
      notify("failed to delete group", true)
    }
  }

  const createInput = (depth: number) => (
    <InlineInput
      depth={depth}
      placeholder="group name"
      icon={<Folder size={11} className="shrink-0 opacity-40" />}
      onConfirm={commitCreate}
      onCancel={() => setCreatingParent(undefined)}
    />
  )

  const skillLeaf = (skill: Skill, depth: number) => {
    const isActive = selectedSkillId === skill.id
    return (
      <div
        key={skill.id}
        onClick={() => { selectSkill(skill.id); setLibraryTab("skills") }}
        className={cn(
          "flex items-center gap-1.5 rounded-sm px-2 py-1 cursor-pointer transition-colors duration-100",
          isActive ? "bg-background text-primary" : "text-secondary hover:bg-background/60"
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
      >
        <Blocks
          size={10}
          className="shrink-0"
          style={{ color: isActive ? "var(--color-foreground)" : "var(--color-muted)" }}
        />
        <span className="text-[11px] font-mono truncate flex-1">{skill.name}</span>
      </div>
    )
  }

  const renderGroup = (node: SkillGroupNode, depth: number): React.ReactNode => {
    const isOpen = expanded.has(node.id)
    const isActive = selectedGroupId === node.id
    const expandable = node.children.length > 0 || node.skills.length > 0
    const count = countSkills(node)

    return (
      <div key={node.id}>
        <div
          // clicking the selected group clears the filter, so there's still a way back to all
          onClick={() => selectGroup(isActive ? null : node.id)}
          onContextMenu={(e) => {
            e.preventDefault()
            selectGroup(node.id)
            setMenu({ x: e.clientX, y: e.clientY, groupId: node.id })
          }}
          className={cn(
            "flex items-center gap-1.5 rounded-sm px-2 py-1 cursor-pointer transition-colors duration-100",
            isActive ? "bg-background text-primary" : "text-secondary hover:bg-background/60"
          )}
          style={{ paddingLeft: 6 + depth * 12 }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggle(node.id) }}
            className="shrink-0 text-muted hover:text-foreground"
            style={{ visibility: expandable ? "visible" : "hidden" }}
          >
            {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
          {isOpen ? (
            <FolderOpen size={11} className="shrink-0" style={{ color: isActive ? "var(--color-foreground)" : "var(--color-muted)" }} />
          ) : (
            <Folder size={11} className="shrink-0" style={{ color: isActive ? "var(--color-foreground)" : "var(--color-muted)" }} />
          )}

          {editingId === node.id ? (
            <div className="flex items-center gap-1 flex-1 min-w-0">
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(node.id)
                  if (e.key === "Escape") setEditingId(null)
                }}
                onBlur={() => commitRename(node.id)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 min-w-0 bg-background border border-border rounded px-1 py-0.5 text-[11px] font-mono outline-none"
              />
              <button onClick={(e) => { e.stopPropagation(); commitRename(node.id) }} className="text-accent shrink-0"><Check size={10} /></button>
              <button onClick={(e) => { e.stopPropagation(); setEditingId(null) }} className="text-muted shrink-0"><X size={10} /></button>
            </div>
          ) : (
            <span className="text-[11px] font-mono truncate flex-1">{node.name}</span>
          )}

          <span className="text-[10px] text-muted shrink-0">{count}</span>
        </div>

        {isOpen && (
          <>
            {node.children.map((child) => renderGroup(child, depth + 1))}
            {node.skills.map((skill) => skillLeaf(skill, depth + 1))}
          </>
        )}
        {creatingParent === node.id && createInput(depth + 1)}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex items-center justify-end px-2 py-1.5 border-b border-border shrink-0">
        <button
          onClick={() => startCreate(null)}
          className="text-muted hover:text-foreground transition-colors"
          aria-label="New group"
        >
          <Plus size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1 flex flex-col gap-0.5">
        {tree.map((node) => renderGroup(node, 0))}
        {creatingParent === null && createInput(0)}

        {ungrouped.length > 0 && (
          // Unlabelled on purpose — a divider keeps these visible without a heading.
          <div className={tree.length > 0 ? "mt-2 pt-2 border-t border-border" : ""}>
            {ungrouped.map((skill) => skillLeaf(skill, 0))}
          </div>
        )}

        {tree.length === 0 && ungrouped.length === 0 && creatingParent === undefined && (
          <span className="px-2 py-1 text-[11px] text-muted">No skills yet</span>
        )}
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "New subgroup", onClick: () => startCreate(menu.groupId) },
            {
              label: "Rename",
              onClick: () => {
                const node = findNode(tree, menu.groupId)
                if (!node) return
                setEditName(node.name)
                setEditingId(menu.groupId)
                setExpanded((prev) => new Set(prev).add(menu.groupId))
              },
            },
            { label: "Delete", onClick: () => handleDelete(menu.groupId), danger: true },
          ]}
        />
      )}
    </div>
  )
}

function findNode(tree: SkillGroupNode[], id: string): SkillGroupNode | null {
  for (const node of tree) {
    if (node.id === id) return node
    const found = findNode(node.children, id)
    if (found) return found
  }
  return null
}

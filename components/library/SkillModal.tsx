import { useEffect, useState } from "react"
import { Blocks, X, Download, Plus } from "lucide-react"
import { Button } from "../ui/Button"
import { Select } from "../ui/Select"
import { useSkillStore } from "@/hooks/store/skillStore"
import { useNotifications } from "@/hooks/store/SidebarStore"
import { Skill, SkillGroup, SkillValue } from "@/lib/types/skill"
import { Template, templateService } from "@/lib/db/template"
import { Snippet } from "@/lib/types/library"
import { libraryService } from "@/lib/db/library"
import { skillFileService, templateToMarkdown } from "@/services/service.skill"
import { exportSkillToFile } from "@/lib/skillExport"
import { cn } from "@/lib/utils"

type SkillModalProps = {
  skill?: Skill
  isCreating: boolean
  onClose: () => void
}

export const SkillModal = ({ skill, isCreating, onClose }: SkillModalProps) => {
  const isEditing = !!skill && !isCreating
  const { notify } = useNotifications()
  const createSkill = useSkillStore((s) => s.createSkill)
  const updateSkill = useSkillStore((s) => s.updateSkill)

  const [name, setName] = useState(skill?.name ?? "")
  const [description, setDescription] = useState(skill?.description ?? "")
  const [groupId, setGroupId] = useState<string | null>(skill?.groupId ?? null)
  const [templateId, setTemplateId] = useState<string | null>(skill?.templateId ?? null)
  const [values, setValues] = useState<SkillValue[]>(skill?.values ?? [])
  const [body, setBody] = useState("")
  const [groups, setGroups] = useState<SkillGroup[]>([])
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    if (isEditing && skill) {
      skillFileService.read(skill.id).then(setBody)
    }
  }, [])

  useEffect(() => {
    const store = useSkillStore.getState()
    setGroups(store.groups)
    if (isCreating && store.selectedGroupId) setGroupId(store.selectedGroupId)
    templateService.getAll().then(setTemplates)
    return useSkillStore.subscribe((state) => setGroups(state.groups))
  }, [])

  const cleanValues = values.filter((v) => v.key.trim())

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      notify("Skill needs a name", true)
      return
    }

    const payload = {
      name: trimmed,
      description: description.trim() || null,
      groupId,
      templateId,
      values: cleanValues,
    }

    try {
      if (isEditing && skill) {
        await updateSkill(skill.id, payload, body)
        notify("skill updated")
      } else {
        await createSkill(payload, body)
        notify("skill saved")
      }
      onClose()
    } catch {
      notify("failed to save skill", true)
    }
  }

  const handleSeedFromTemplate = async () => {
    if (!templateId) return
    setBody(await templateToMarkdown(templateId))
    notify("seeded from template")
  }

  const handleExport = async () => {
    if (!skill) return
    try {
      const exported = await exportSkillToFile(skill)
      if (exported) notify("skill exported")
    } catch {
      notify("failed to export skill", true)
    }
  }

  return (
    <div className="w-full h-full flex flex-col text-sm">
      <div className="flex items-center gap-2 border-b p-4 justify-between shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Blocks size={13} style={{ color: "var(--color-accent)" }} className="shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="skill name"
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-foreground outline-none text-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isEditing && (
            <Button variant="ghost" size="sm" onClick={handleExport}>
              <Download size={11} /> export
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleSave}>
            {isEditing ? "Update" : "Save"}
          </Button>
          <Button variant="danger" size="sm" onClick={onClose}>
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-h-0">
        <div className="flex flex-wrap gap-4">
          <Field label="Description" className="flex-1 min-w-[240px]">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="what this skill does"
              className="bg-transparent text-foreground outline-none text-[12px] w-full"
            />
          </Field>

          <Field label="Group" className="w-52">
            <Select
              value={groupId ?? ""}
              onChange={(value) => setGroupId(value || null)}
              className="w-full"
              panelWidth={200}
              options={[
                { value: "", label: "Ungrouped" },
                ...groups.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </Field>

          <Field label="Template" className="w-52">
            <Select
              value={templateId ?? ""}
              onChange={(value) => setTemplateId(value || null)}
              className="w-full"
              panelWidth={200}
              options={[
                { value: "", label: "None" },
                ...templates.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </Field>
        </div>

        <ValuesEditor values={values} onChange={setValues} />

        <div className="flex flex-col flex-1 gap-1 min-h-0">
          <div className="flex items-center justify-between">
            <label className="text-muted text-[10px] uppercase tracking-wider">Skill markdown</label>
            {templateId && (
              <button
                onClick={handleSeedFromTemplate}
                className="text-[10px] text-muted hover:text-foreground transition-colors"
              >
                seed from template
              </button>
            )}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="---&#10;name: my-skill&#10;description: …&#10;---&#10;&#10;## Instructions&#10;Use {{some-value}} where needed."
            className="flex-1 min-h-[240px] resize-none bg-transparent border border-border rounded-lg p-3 text-[12px] font-mono text-foreground outline-none"
          />
        </div>
      </div>
    </div>
  )
}

const ValuesEditor = ({
  values,
  onChange,
}: {
  values: SkillValue[]
  onChange: (values: SkillValue[]) => void
}) => {
  const [snippets, setSnippets] = useState<Snippet[]>([])

  useEffect(() => {
    libraryService.getAll().then(setSnippets)
  }, [])

  const setAt = (index: number, patch: Partial<SkillValue>) =>
    onChange(values.map((v, i) => (i === index ? { ...v, ...patch } : v)))

  const removeAt = (index: number) =>
    onChange(values.filter((_, i) => i !== index))

  const addFromLibrary = (key: string) => {
    const snippet = snippets.find((s) => s.key === key)
    if (!snippet || values.some((v) => v.key === snippet.key)) return
    onChange([...values, { key: snippet.key, value: snippet.value }])
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-muted text-[10px] uppercase tracking-wider">Values</label>
        <div className="flex items-center gap-2">
          {snippets.length > 0 && (
            <Select
              value=""
              onChange={addFromLibrary}
              size="sm"
              placeholder="+ from library"
              panelWidth={180}
              options={snippets.map((s) => ({ value: s.key, label: s.key }))}
            />
          )}
          <button
            onClick={() => onChange([...values, { key: "", value: "" }])}
            className="text-[10px] text-muted hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <Plus size={10} /> add
          </button>
        </div>
      </div>

      {values.length === 0 && (
        <span className="text-[11px] text-muted">No key/value pairs yet</span>
      )}

      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={value.key}
            onChange={(e) => setAt(index, { key: e.target.value })}
            placeholder="key"
            className="w-40 shrink-0 bg-background border border-border rounded px-2 py-1 text-[11px] font-mono outline-none"
          />
          <input
            value={value.value}
            onChange={(e) => setAt(index, { value: e.target.value })}
            placeholder="value"
            className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-[11px] font-mono outline-none"
          />
          <button
            onClick={() => removeAt(index)}
            className="text-muted hover:text-red-400 transition-colors shrink-0"
          >
            <X size={11} />
          </button>
        </div>
      ))}
    </div>
  )
}

const Field = ({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <label className="text-muted text-[10px] uppercase tracking-wider">{label}</label>
    {children}
  </div>
)

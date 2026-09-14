import { create } from "zustand"
import { skillService, skillGroupService } from "@/lib/db/skills"
import { skillServiceWithFiles } from "@/services/service.skill"
import {
  CreateSkillInput,
  Skill,
  SkillGroup,
  SkillGroupNode,
  SkillValue,
} from "@/lib/types/skill"

export type LibraryPanelTab = "skills" | "graph"

type SkillStore = {
  skills: Skill[]
  groups: SkillGroup[]
  tree: SkillGroupNode[]
  loading: boolean

  // which panel the Library view is showing
  libraryTab: LibraryPanelTab
  setLibraryTab: (tab: LibraryPanelTab) => void

  // selection
  selectedSkillId: string | null
  selectSkill: (id: string | null) => void
  selectedSkill: () => Skill | null

  selectedGroupId: string | null
  selectGroup: (id: string | null) => void

  // graph scope — null is the global view
  graphScopeId: string | null
  setGraphScope: (id: string | null) => void

  isCreatingSkill: boolean
  setCreatingSkill: (creating: boolean) => void

  // data
  load: () => Promise<void>

  createSkill: (input: CreateSkillInput, body?: string) => Promise<Skill>
  updateSkill: (
    id: string,
    patch: Partial<{
      name: string
      description: string | null
      groupId: string | null
      templateId: string | null
      values: SkillValue[]
    }>,
    body?: string
  ) => Promise<Skill>
  deleteSkill: (id: string) => Promise<void>

  createGroup: (name: string, parentId?: string | null) => Promise<SkillGroup>
  renameGroup: (id: string, name: string) => Promise<void>
  deleteGroup: (id: string, keepContents?: boolean) => Promise<void>
}

export const useSkillStore = create<SkillStore>((set, get) => ({
  skills: [],
  groups: [],
  tree: [],
  loading: false,

  libraryTab: "skills",
  setLibraryTab: (libraryTab) => set({ libraryTab }),

  selectedSkillId: null,
  selectSkill: (id) =>
    set({ selectedSkillId: id, isCreatingSkill: false }),

  selectedSkill: () => {
    const { skills, selectedSkillId } = get()
    return skills.find((s) => s.id === selectedSkillId) ?? null
  },

  selectedGroupId: null,
  selectGroup: (id) => set({ selectedGroupId: id }),

  graphScopeId: null,
  setGraphScope: (id) => set({ graphScopeId: id }),

  isCreatingSkill: false,
  setCreatingSkill: (isCreatingSkill) =>
    set({ isCreatingSkill, selectedSkillId: isCreatingSkill ? null : get().selectedSkillId }),

  load: async () => {
    set({ loading: true })
    try {
      const [skills, groups, tree] = await Promise.all([
        skillService.getAll(),
        skillGroupService.getAll(),
        skillGroupService.getTree(),
      ])
      set({ skills, groups, tree })
    } finally {
      set({ loading: false })
    }
  },

  createSkill: async (input, body = "") => {
    const skill = await skillServiceWithFiles.create(input, body)
    await get().load()
    set({ selectedSkillId: skill.id, isCreatingSkill: false })
    return skill
  },

  updateSkill: async (id, patch, body) => {
    const skill = await skillServiceWithFiles.save(id, patch, body)
    await get().load()
    return skill
  },

  deleteSkill: async (id) => {
    await skillServiceWithFiles.remove(id)
    set((state) => ({
      selectedSkillId: state.selectedSkillId === id ? null : state.selectedSkillId,
    }))
    await get().load()
  },

  createGroup: async (name, parentId = null) => {
    const group = await skillGroupService.create({ name, parentId })
    await get().load()
    return group
  },

  renameGroup: async (id, name) => {
    await skillGroupService.update(id, { name })
    await get().load()
  },

  deleteGroup: async (id, keepContents = false) => {
    if (keepContents) {
      await skillGroupService.deleteKeepContents(id)
    } else {
      await skillGroupService.delete(id)
    }
    set((state) => ({
      selectedGroupId: state.selectedGroupId === id ? null : state.selectedGroupId,
      graphScopeId: state.graphScopeId === id ? null : state.graphScopeId,
    }))
    await get().load()
  },
}))

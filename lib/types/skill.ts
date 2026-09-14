export interface SkillValue {
  key: string
  value: string
}

export interface Skill {
  id: string
  name: string
  description: string | null
  groupId: string | null
  templateId: string | null
  values: SkillValue[]
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SkillGroup {
  id: string
  name: string
  parentId: string | null
  orderIndex: number
  meta: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface SkillGroupNode extends SkillGroup {
  children: SkillGroupNode[]
  skills: Skill[]
}

export interface CreateSkillInput {
  name: string
  description?: string | null
  groupId?: string | null
  templateId?: string | null
  values?: SkillValue[]
  meta?: Record<string, unknown>
}

export interface UpdateSkillInput {
  name?: string
  description?: string | null
  groupId?: string | null
  templateId?: string | null
  values?: SkillValue[]
  meta?: Record<string, unknown>
}

export interface CreateSkillGroupInput {
  name: string
  parentId?: string | null
  orderIndex?: number
  meta?: Record<string, unknown>
}

export interface UpdateSkillGroupInput {
  name?: string
  parentId?: string | null
  orderIndex?: number
  meta?: Record<string, unknown>
}

export type SkillGraphScope = string | null

export interface SkillMarkdown {
  name: string
  description: string
  body: string
}

"use client"

import { useState, useEffect } from "react"
import { usePromptStore } from "@/hooks/store/PromptStore"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { TemplateSelector } from "../Prompt/TemplateSelector"
import { TemplateSection } from "@/lib/db/template"
import { Template } from "@/lib/db/template"
import { SmartEditor } from "../ui/SmartTextEditor"


// ── SectionBlock ───────────────────────────────────────────────────────────────

interface SectionBlockProps {
  section: TemplateSection
  value: string
  onChange: (value: string) => void
}

function SectionBlock({ section, value, onChange }: SectionBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  })
  const {updateSection} = usePromptStore()
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group space-y-2">
      <div className="flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted opacity-0 group-hover:opacity-100 transition-opacity active:cursor-grabbing"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <label className="text-xs font-medium uppercase tracking-wide text-muted">
          {section.title}
        </label>
      </div>
      <SmartEditor
        value={value}
        onChange={(plain, doc) => updateSection(section.id, plain, doc)}
        placeholder={section.placeholder || `Enter ${section.title.toLowerCase()}...`}
        minHeight={96}
      />
    </div>
  )
}

// ── FreeformBlock ──────────────────────────────────────────────────────────────

function FreeformBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex h-full flex-col">
      <label className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Prompt
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full rounded-lg outline-0 border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted/60 resize-none font-mono"
        placeholder="Write your prompt..."
      />
    </div>
  )
}

// ── BuilderPanel ───────────────────────────────────────────────────────────────

export function BuilderPanel() {
  const {
    sections,
    filledSections,
    loading,
    activePrompt,
    updateSection,
    reorderSections,
    updateTemplate,
  } = usePromptStore()

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    reorderSections(arrayMove(sections, oldIndex, newIndex))
  }

  const handleTemplateChange = (template: Template) => {
    updateTemplate(template.id)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-xs text-muted">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Template Selector */}
      <div className="shrink-0 border-b border-border px-4 py-3">
        <TemplateSelector
          value={activePrompt?.template_id ?? null}
          onChange={handleTemplateChange}
        />
      </div>

      {/* Sections or Freeform */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!sections.length ? (
          <SmartEditor
            value={filledSections["__freeform__"] || ""}
            onChange={(plain, doc) => updateSection("__freeform__", plain, doc)}
            minHeight={300}
          />
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {sections.map((section) => (
                <SectionBlock
                  key={section.id}
                  section={section}
                  value={filledSections[section.id] || ""}
                  onChange={(val) => updateSection(section.id, val)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  )
}
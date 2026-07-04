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
import { TemplateSelector } from "./TemplateSelector"
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
  const { updateSection } = usePromptStore()
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group border isolate space-y-2 ">
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
      <div className="border relative z-0">
           <SmartEditor
        value={value}
        onChange={(plain, doc) => updateSection(section.id, plain, doc)}
        placeholder={section.placeholder || `Enter ${section.title.toLowerCase()}...`}
      />
      </div>
     

    </div>
  )
}


// ── BuilderPanel ───────────────────────────────────────────────────────────────

export function BuilderPanel() {
  const {
    sections,
    filledSections,
    loading,
    updateSection,
    reorderSections,
  } = usePromptStore()

  const sensors = useSensors(useSensor(PointerSensor))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = sections.findIndex((s) => s.id === active.id)
    const newIndex = sections.findIndex((s) => s.id === over.id)
    reorderSections(arrayMove(sections, oldIndex, newIndex))
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
  

      {/* Sections or Freeform */}
      <div className="flex-1 overflow-y-auto p-6 ">
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
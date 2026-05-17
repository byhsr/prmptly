import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTemplateStore } from "@/hooks/store/templateStore";
import { TemplateSection } from "@/lib/db/template";

// ── Sortable Section Row ──────────────────────────────────────────────────────

function SectionRow({ section }: { section: TemplateSection }) {
  const { updateSection, deleteSection } = useTemplateStore();
  const [title, setTitle] = useState(section.title);
  const [placeholder, setPlaceholder] = useState(section.placeholder ?? "");

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start gap-2 group rounded-lg px-3 py-2.5"
      css-border="1px solid var(--border)"
      {...({} as any)}
    >
      {/* drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="mt-1 cursor-grab active:cursor-grabbing shrink-0"
        style={{ color: "var(--muted)", fontSize: 14 }}
        tabIndex={-1}
      >
        ⠿
      </button>

      <div className="flex flex-col gap-1.5 flex-1">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => updateSection(section.id, { title })}
          placeholder="Section title"
          className="w-full bg-transparent text-sm font-medium outline-none"
          style={{ color: "var(--foreground)" }}
        />
        <input
          value={placeholder}
          onChange={(e) => setPlaceholder(e.target.value)}
          onBlur={() => updateSection(section.id, { placeholder })}
          placeholder="Placeholder hint..."
          className="w-full bg-transparent text-xs outline-none"
          style={{ color: "var(--muted)" }}
        />
      </div>

      <button
        onClick={() => deleteSection(section.id)}
        className="mt-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
        style={{ color: "var(--muted)" }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Template Form ─────────────────────────────────────────────────────────────

function TemplateForm() {
  const {
    templates,
    selectedTemplateId,
    sections,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    addSection,
    reorderSections,
    selectTemplate,
  } = useTemplateStore();

  const isNew = selectedTemplateId === null;
  const selected = templates.find((t) => t.id === selectedTemplateId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (selected) {
      setName(selected.name);
      setDescription(selected.description ?? "");
    } else {
      setName("");
      setDescription("");
    }
  }, [selectedTemplateId]);

  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order_index: i,
    }));
    reorderSections(reordered);
  }

  async function handleSave() {
    if (!name.trim()) return;
    if (isNew) {
      const id = await createTemplate(name.trim(), description.trim());
      selectTemplate(id);
    } else if (selectedTemplateId) {
      await updateTemplate(selectedTemplateId, {
        name: name.trim(),
        description: description.trim(),
      });
    }
  }

  const isSystem = selected?.is_system === 1;

  return (
<div className="flex flex-col gap-8 relative h-screen w-full max-w-4xl  py-20 p-10 ">
  {/* name + description */}
<div className="flex flex-col h-full w-full max-w-4xl px-10  pb-6">

  {/* name + description */}
  <div className="flex flex-col gap-2 shrink-0 mb-8">
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      placeholder="Template name"
      disabled={isSystem}
      className="bg-transparent text-xl font-semibold outline-none w-full"
      style={{ color: "var(--foreground)" }}
    />
    <input
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="Short description (optional)"
      disabled={isSystem}
      className="bg-transparent text-sm outline-none w-full"
      style={{ color: "var(--muted)" }}
    />
  </div>

  {/* sections */}
  <div className="flex flex-col gap-3 flex-1 min-h-0">
    <div className="flex items-center justify-between shrink-0">
      <span className="text-xs font-medium">Sections</span>
      {!isSystem && selectedTemplateId && (
        <button
          onClick={addSection}
          className="text-xs px-2 py-1 rounded-md transition-colors"
          style={{ background: "var(--surface)", color: "var(--foreground)", border: "1px solid var(--border)" }}
        >
          + Add section
        </button>
      )}
    </div>

    <div className="flex-1 min-h-0 rounded-xl overflow-hidden border">
    <div className="sections-scroll h-full overflow-y-auto rounded-sm" 
    style={{paddingBlock: "10px"}}>
      {loading ? (
        <p className="text-xs p-4" style={{ color: "var(--muted)" }}>Loading...</p>
      ) : isNew ? (
        <p className="text-xs p-4" style={{ color: "var(--muted)" }}>Save the template first to add sections.</p>
      ) : sections.length === 0 ? (
        <p className="text-xs p-4" style={{ color: "var(--muted)" }}>No sections yet. Add one </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col">
              <AnimatePresence initial={false}>
                {sections.map((section) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <SectionRow section={section} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
    </div>
  </div>

  {/* actions */}
  <div className="shrink-0 pt-6">
    {!isSystem ? (
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            background: "var(--accent)",
            color: "var(--accent-foreground)",
            opacity: name.trim() ? 1 : 0.4,
          }}
        >
          {isNew ? "Create template" : "Save changes"}
        </button>

        {!isNew && (
          <button
            onClick={() => deleteTemplate(selectedTemplateId!)}
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
          >
            Delete
          </button>
        )}
      </div>
    ) : (
      <p className="text-xs" style={{ color: "var(--muted)" }}>System templates are read-only.</p>
    )}
  </div>

</div>
</div>
  );
}

// ── Template View ─────────────────────────────────────────────────────────────

export function TemplateView() {
  const { selectedTemplateId, selectTemplate } = useTemplateStore();

  return (
    <div className="flex  flex-col h-full max-w-full">
      {/* navbar */}
      {/* <div
        className="flex items-center relative justify-end px-6 pt-2 shrink-0" >

        <button
          onClick={() => selectTemplate(null)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{
            background: "var(--surface)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
        >
          <span>+</span> New
        </button>
      </div> */}

      {/* content */}
      <div className="flex-1 overflow-hidden">
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
    </div>
  );
}
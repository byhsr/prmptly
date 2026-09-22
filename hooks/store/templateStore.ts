import { create } from "zustand";
import {templateService, Template, TemplateSection} from '@/lib/db/template'

interface TemplateStore {
  templates: Template[];
  selectedTemplateId: string | null;
  sections: TemplateSection[];
  loading: boolean;

  loadTemplates: () => Promise<void>;
  selectTemplate: (id: string | null) => Promise<void>;
  createTemplate: (name: string, description?: string) => Promise<string>;
  updateTemplate: (id: string, fields: Partial<Pick<Template, "name" | "description">>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  addSection: () => Promise<void>;
  updateSection: (id: string, fields: Partial<Pick<TemplateSection, "title" | "content_json">>) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  reorderSections: (sections: TemplateSection[]) => Promise<void>;
}

export const useTemplateStore = create<TemplateStore>((set, get) => ({
  templates: [],
  selectedTemplateId: null,
  sections: [],
  loading: false,

  loadTemplates: async () => {
    const templates = await templateService.getAll();
    set({ templates });
  },

  selectTemplate: async (id) => {
    if (!id) {
      set({ selectedTemplateId: null, sections: [] });
      return;
    }
    set({ loading: true, selectedTemplateId: id });
    const sections = await templateService.getSections(id);
    set({ sections, loading: false });
  },

  createTemplate: async (name, description) => {
    const id = await templateService.create(name, description);
    await get().loadTemplates();
    return id;
  },

  updateTemplate: async (id, fields) => {
    await templateService.update(id, fields);
    await get().loadTemplates();
  },

  deleteTemplate: async (id) => {
    await templateService.delete(id);
    if (get().selectedTemplateId === id) {
      set({ selectedTemplateId: null, sections: [] });
    }
    await get().loadTemplates();
  },

  addSection: async () => {
    const { selectedTemplateId, sections } = get();
    if (!selectedTemplateId) return;
    await templateService.addSection(selectedTemplateId, sections.length);
    await get().selectTemplate(selectedTemplateId);
  },

  updateSection: async (id, fields) => {
    await templateService.updateSection(id, fields);
    const { selectedTemplateId } = get();
    if (selectedTemplateId) await get().selectTemplate(selectedTemplateId);
  },

  deleteSection: async (id) => {
    await templateService.deleteSection(id);
    const { selectedTemplateId } = get();
    if (selectedTemplateId) await get().selectTemplate(selectedTemplateId);
  },

  reorderSections: async (sections) => {
    set({ sections }); // optimistic update
    await templateService.reorderSections(sections);
  },
}));
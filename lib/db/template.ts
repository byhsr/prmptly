import { getDB } from ".";
import { v4 as uuid } from "uuid";

export interface Template {
  id: string;
  name: string;
  description: string | null;
  is_system: number;
  created_at: string;
}

export interface TemplateSection {
  id: string;
  template_id: string;
  title: string;
  placeholder: string | null;
  order_index: number;
  created_at: string;
}

export const templateService = {
  getAll: async (): Promise<Template[]> => {
    const db = getDB();
    return db.select("SELECT * FROM templates ORDER BY created_at ASC");
  },

  getSections: async (templateId: string): Promise<TemplateSection[]> => {
    const db = getDB();
    return db.select(
      "SELECT * FROM template_sections WHERE template_id = ? ORDER BY order_index ASC",
      [templateId]
    );
  },

  create: async (name: string, description?: string): Promise<string> => {
    const db = getDB();
    const id = uuid();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO templates (id, name, description, is_system, created_at) VALUES (?, ?, ?, 0, ?)",
      [id, name, description ?? null, now]
    );
    return id;
  },

  update: async (id: string, fields: Partial<Pick<Template, "name" | "description">>): Promise<void> => {
    const db = getDB();
    const entries = Object.entries(fields);
    const sql = `UPDATE templates SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`;
    await db.execute(sql, [...entries.map(([, v]) => v), id]);
  },

  delete: async (id: string): Promise<void> => {
    const db = getDB();
    await db.execute("DELETE FROM templates WHERE id = ? AND is_system = 0", [id]);
  },

  addSection: async (templateId: string, order_index: number): Promise<void> => {
    const db = getDB();
    const id = uuid();
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO template_sections (id, template_id, title, placeholder, order_index, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, templateId, "New Section", null, order_index, now]
    );
  },

  updateSection: async (id: string, fields: Partial<Pick<TemplateSection, "title" | "placeholder">>): Promise<void> => {
    const db = getDB();
    const entries = Object.entries(fields);
    const sql = `UPDATE template_sections SET ${entries.map(([k]) => `${k} = ?`).join(", ")} WHERE id = ?`;
    await db.execute(sql, [...entries.map(([, v]) => v), id]);
  },

  deleteSection: async (id: string): Promise<void> => {
    const db = getDB();
    await db.execute("DELETE FROM template_sections WHERE id = ?", [id]);
  },

  reorderSections: async (sections: TemplateSection[]): Promise<void> => {
    const db = getDB();
    for (let i = 0; i < sections.length; i++) {
      await db.execute(
        "UPDATE template_sections SET order_index = ? WHERE id = ?",
        [i, sections[i].id]
      );
    }
  },
};
import { getDB } from ".";

export interface Template {
  id: string;
  name: string;
  description: string | null;
  is_system: number;
  meta_json: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateSection {
  id: string;
  template_id: string;
  title: string;
  content_json: string;
  order_index: number;
  meta_json: string;
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
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO templates (id, name, description, is_system, meta_json, created_at, updated_at)
       VALUES (?, ?, ?, 0, '{}', ?, ?)`,
      [id, name, description ?? null, now, now]
    );
    return id;
  },

  update: async (id: string, fields: Partial<Pick<Template, "name" | "description">>): Promise<void> => {
    const db = getDB();
    const entries = Object.entries(fields);
    const sql = `UPDATE templates SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
    await db.execute(sql, [...entries.map(([, v]) => v), new Date().toISOString(), id]);
  },

  delete: async (id: string): Promise<void> => {
    const db = getDB();
    await db.execute("DELETE FROM templates WHERE id = ? AND is_system = 0", [id]);
  },

  addSection: async (templateId: string, order_index: number): Promise<void> => {
    const db = getDB();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
      `INSERT INTO template_sections (id, template_id, title, content_json, order_index, meta_json, created_at)
       VALUES (?, ?, ?, '{}', ?, '{}', ?)`,
      [id, templateId, "New Section", order_index, now]
    );
  },

  updateSection: async (id: string, fields: Partial<Pick<TemplateSection, "title" | "content_json">>): Promise<void> => {
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
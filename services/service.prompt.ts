// Rewritten for document schema — kept as a thin compatibility layer
import { createDocument, getDocument, deleteDocument } from "@/lib/db/document";
import { getScratchpadPath, getCanvasPath, getOutputPath, getDocumentDir } from "@/lib/fs/fsHelpers";
import { writeFile, readFile, ensureDirectory } from "@/lib/fs/fs";
import { writeJson } from "@/lib/editor/ReadAndCompile";
import { DocumentSection } from "@/lib/types/Document";
import { CanvasFlow } from "@/lib/types/canvas.types";

type CreatePromptInput = {
  name: string;
  template_id?: string | null;
  collection_id?: string | null;
};

type PromptResult = {
  id: string;
  name: string;
  template_id: string | null;
  collection_id: string | null;
  version: {
    id: string;
    version_number: number;
    label: string | null;
    builder_content: { sectionId: string; order: number; value: string; doc?: unknown }[];
    scratchpad: string;
    output: { text: string | null; json: string | null; xml: string | null };
  };
};

const EMPTY_CANVAS: CanvasFlow = { nodes: [], edges: [] };

export async function createPrompt({ name, template_id = null, collection_id = null }: CreatePromptInput) {
  const id = crypto.randomUUID();

  // Create directory for scratchpad files
  await ensureDirectory(await getDocumentDir(id));

  const scratchpadTextPath = await getScratchpadPath(id);
  const scratchpadFlowPath = await getCanvasPath(id);
  const outputPath = await getOutputPath(id);

  // Create empty scratchpad files
  await writeFile(scratchpadTextPath, "");
  await writeJson(scratchpadFlowPath, EMPTY_CANVAS);

  // Create the document in DB
  const doc = await createDocument({
    type: "prompt",
    name,
    templateId: template_id ?? undefined,
    collectionId: collection_id ?? undefined,
    sections: [],
    meta: {},
  });

  // Write initial empty output
  await writeJson(outputPath, { output: "" });

  return { id: doc.id, version_id: doc.id };
}

export async function readPrompt(promptId: string): Promise<PromptResult | null> {
  const doc = await getDocument(promptId);
  if (!doc) return null;

  // Read scratchpad text from file
  let scratchpad = "";
  try {
    scratchpad = await readFile(await getScratchpadPath(promptId));
  } catch { /* file may not exist yet */ }

  // Read output from DB's linked output or build from sections
  const output = {
    text: null as string | null,
    json: null as string | null,
    xml: null as string | null,
  };

  return {
    id: doc.id,
    name: doc.name,
    template_id: doc.templateId,
    collection_id: doc.collectionId,
    version: {
      id: doc.id,
      version_number: 1,
      label: "v1",
      builder_content: (doc.sections || []).map((s, i) => ({
        sectionId: s.id,
        order: s.order ?? i,
        value: s.value || "",
        doc: s.doc,
      })),
      scratchpad,
      output,
    },
  };
}

export async function updatePromptContent(input: {
  promptId: string;
  scratchpad?: string;
  output?: { text?: string; json?: string; xml?: string };
  builder_content?: Array<{ sectionId: string; order: number; value: string; doc?: unknown }>;
}) {
  const { promptId, scratchpad, output, builder_content } = input;

  if (builder_content) {
    const sections: DocumentSection[] = builder_content.map((b) => ({
      id: b.sectionId,
      order: b.order,
      title: "",
      value: b.value,
      doc: b.doc as any,
    }));

    await (await import("@/lib/db/document")).updateDocument(promptId, { sections });
  }

  if (typeof scratchpad === "string") {
    await writeFile(await getScratchpadPath(promptId), scratchpad);
  }

  if (output) {
    const outputPath = await getOutputPath(promptId);
    await writeJson(outputPath, output);
  }

  return { ok: true };
}

export async function deletePrompt(promptId: string) {
  await deleteDocument(promptId);
  try {
    const { deleteFolder } = await import("@/lib/fs/fs");
    await deleteFolder(await getDocumentDir(promptId));
  } catch { /* folder may not exist */ }
}

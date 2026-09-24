import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"
import { NOTE_SPAN_SOURCE, isNoteColor, noteOpenLength } from "@/lib/editor/notes"

// `%% note %%` is plain text in the document, so pretty mode would otherwise show the
// delimiters as ordinary prose. A decoration is view-only — it cannot reach serialization —
// which makes it the one way to hide the markers and tint notes without risking the
// markdown round-trip. The opening `%%{key}` and closing `%%` become hidden spans; only the
// note body is painted, in its own color.

function collect(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []
  const re = new RegExp(NOTE_SPAN_SOURCE, "g")

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const scan = new RegExp(re.source, "g")
    let match: RegExpExecArray | null
    while ((match = scan.exec(node.text)) !== null) {
      const key = isNoteColor(match[1]) ? match[1] : null
      const start = pos + match.index
      const openEnd = start + noteOpenLength(match[1])
      const end = start + match[0].length
      const closeStart = end - 2

      decorations.push(
        Decoration.inline(start, openEnd, { class: "md-note-delim" })
      )

      if (closeStart > openEnd) {
        decorations.push(
          Decoration.inline(openEnd, closeStart, {
            class: `md-note md-note--${key ?? "default"}`,
          })
        )
      }

      decorations.push(
        Decoration.inline(closeStart, end, { class: "md-note-delim" })
      )
    }
  })

  return DecorationSet.create(doc, decorations)
}

export const NoteDecoration = Extension.create({
  name: "noteDecoration",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("noteDecoration"),
        state: {
          init: (_config, { doc }) => collect(doc),
          apply: (tr, value) => (tr.docChanged ? collect(tr.doc) : value.map(tr.mapping, tr.doc)),
        },
        props: {
          decorations(this: Plugin, state) {
            return this.getState(state) as DecorationSet
          },
        },
      }),
    ]
  },
})

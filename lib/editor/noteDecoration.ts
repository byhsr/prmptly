import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import type { Node as ProseMirrorNode } from "@tiptap/pm/model"

// `%% note %%` is plain text in the document, so pretty mode would otherwise show the
// delimiters as ordinary prose. A decoration is view-only — it cannot reach serialization —
// which makes it the one way to tint notes without risking the markdown round-trip.

const NOTE_SPAN = /%%[^\n]*?%%/g

function collect(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = []

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return

    const re = new RegExp(NOTE_SPAN.source, "g")
    let match: RegExpExecArray | null
    while ((match = re.exec(node.text)) !== null) {
      decorations.push(
        Decoration.inline(pos + match.index, pos + match.index + match[0].length, {
          class: "md-note",
        })
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

import { ContextMenu, type ContextMenuItem } from "@/components/ui/ContextMenu"
import { NOTE_COLORS, type NoteColorKey } from "@/lib/editor/notes"

interface NoteContextMenuProps {
  x: number
  y: number
  /** Color of the comment under the caret, if any — ringed in the swatch row. */
  activeColor: NoteColorKey | null
  canRemove: boolean
  onPick: (color: NoteColorKey) => void
  onRemove: () => void
  onClose: () => void
}

// The right-click menu shared by the pretty and raw markdown editors: pick a color to
// comment the selection (or recolor the comment under the caret), plus a remove action.
export function NoteContextMenu({
  x,
  y,
  activeColor,
  canRemove,
  onPick,
  onRemove,
  onClose,
}: NoteContextMenuProps) {
  const items: ContextMenuItem[] = [
    {
      label: "Comment",
      colors: NOTE_COLORS,
      active: activeColor,
      onPick: (key) => onPick(key as NoteColorKey),
    },
  ]

  if (canRemove) {
    items.push({ label: "Remove comment", danger: true, onClick: onRemove })
  }

  return <ContextMenu x={x} y={y} onClose={onClose} items={items} />
}

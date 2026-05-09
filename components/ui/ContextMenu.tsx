export const ContextMenu = ({ x, y, onClose, items }: {
  x: number
  y: number
  onClose: () => void
  items: { label: string; onClick: () => void; danger?: boolean }[]
}) => {
  return (
    <div
      style={{ position: "fixed", top: y, left: x }}
      className="bg-zinc-900 border rounded p-1 z-50"
      onMouseLeave={onClose}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`px-2 py-1 cursor-pointer rounded ${item.danger ? "hover:bg-red-800 text-red-400" : "hover:bg-zinc-800"}`}
          onClick={() => { item.onClick(); onClose() }}
        >
          {item.label}
        </div>
      ))}
    </div>
  )
}
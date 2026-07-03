import {SettingsView }from "./SettingsView"

export function SettingsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose} // click outside closes
    >
      <div
        onClick={(e) => e.stopPropagation()} // don't close when clicking inside
        className="w-[720px] h-[480px] rounded-lg overflow-hidden"
        style={{ background: "var(--color-surface, #0d0d0d)" }}
      >
        <SettingsView  />
      </div>
    </div>
  )
}
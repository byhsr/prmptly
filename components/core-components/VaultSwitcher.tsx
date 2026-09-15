import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { Select } from "../ui/Select"
import { useVaultStore } from "@/hooks/store/VaultStore"
import { useNotifications } from "@/hooks/store/SidebarStore"

// Lives inside the vault dropdown. Creating a vault swaps the row for an input so the whole
// flow stays in the menu rather than opening a dialog.
function NewVaultRow() {
  const createVault = useVaultStore((s) => s.createVault)
  const { notify } = useNotifications()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const value = name.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      await createVault(value)
    } catch {
      notify("Could not create vault", true)
      setBusy(false)
    }
  }

  if (!creating) {
    return (
      <button
        type="button"
        onClick={() => setCreating(true)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-border/30 hover:text-foreground"
      >
        <Plus size={11} aria-hidden="true" />
        New vault
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      <input
        autoFocus
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit()
          if (e.key === "Escape") { setCreating(false); setName("") }
        }}
        placeholder="vault name"
        aria-label="New vault name"
        className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:border-foreground/40 disabled:opacity-50"
      />
      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-accent transition-colors hover:bg-border/30 disabled:opacity-50"
      >
        create
      </button>
    </div>
  )
}

export function VaultSwitcher() {
  const vaults = useVaultStore((s) => s.vaults)
  const activeId = useVaultStore((s) => s.activeId)
  const switchVault = useVaultStore((s) => s.switchVault)

  useEffect(() => {
    useVaultStore.getState().hydrate()
  }, [])

  // Nothing to switch between until onboarding has registered a vault
  if (vaults.length === 0) return null

  return (
    <Select
      value={activeId}
      onChange={(id) => switchVault(id)}
      options={vaults.map((vault) => ({ value: vault.id, label: vault.name }))}
      placeholder="Vault"
      size="sm"
      panelWidth={220}
      className="max-w-[150px]"
      footer={<NewVaultRow />}
    />
  )
}

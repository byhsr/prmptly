import { create } from "zustand"
import { check, type Update } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { log } from "@/lib/utils"

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installing"
  | "current"
  | "error"

// The plugin's Update handle carries methods, so it stays out of the store
// rather than sitting in state the UI would treat as plain serializable data.
let pendingUpdate: Update | null = null

type UpdateStore = {
  status: UpdateStatus
  version: string | null
  notes: string | null
  progress: number
  error: string | null
  dismissed: boolean
  check: (manual?: boolean) => Promise<void>
  install: () => Promise<void>
  dismiss: () => void
}

const reason = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const useUpdateStore = create<UpdateStore>((set, get) => ({
  status: "idle",
  version: null,
  notes: null,
  progress: 0,
  error: null,
  dismissed: false,

  check: async (manual = false) => {
    // A dev build has no published release to compare against, so the check
    // would only ever report the running version as newest.
    if (import.meta.env.DEV) return
    if (get().status === "checking" || get().status === "downloading") return

    set({ status: "checking", error: null })
    try {
      const update = await check()
      if (!update) {
        set({ status: manual ? "current" : "idle", version: null, notes: null })
        return
      }
      pendingUpdate = update
      set({
        status: "available",
        version: update.version,
        notes: update.body ?? null,
        dismissed: false,
      })
    } catch (e) {
      log.error("Update check failed", reason(e))
      // An offline user gets no notice they can act on, so a background check
      // stays quiet and only an explicit one reports the failure.
      set(manual ? { status: "error", error: reason(e) } : { status: "idle" })
    }
  },

  install: async () => {
    if (!pendingUpdate) return
    set({ status: "downloading", progress: 0, error: null })
    try {
      let total = 0
      let received = 0
      await pendingUpdate.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0
        } else if (event.event === "Progress") {
          received += event.data.chunkLength
          set({
            progress: total ? Math.min(100, Math.round((received / total) * 100)) : 0,
          })
        } else if (event.event === "Finished") {
          set({ status: "installing" })
        }
      })
      // The Windows installer takes over and exits the app; macOS and Linux
      // need an explicit relaunch to come back up on the new version.
      await relaunch()
    } catch (e) {
      log.error("Update install failed", reason(e))
      set({ status: "error", error: reason(e) })
    }
  },

  dismiss: () => set({ dismissed: true }),
}))

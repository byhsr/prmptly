import { create } from "zustand"
import { canvasService, type CanvasMeta } from "@/services/service.canvas"

interface CanvasStore {
  canvases: CanvasMeta[]
  selectedCanvasId: string | null
  loading: boolean

  load: () => Promise<void>
  selectCanvas: (id: string | null) => void
  createCanvas: (name: string) => Promise<string>
  renameCanvas: (id: string, name: string) => Promise<void>
  deleteCanvas: (id: string) => Promise<void>
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  canvases: [],
  selectedCanvasId: null,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const canvases = await canvasService.list()
      const { selectedCanvasId } = get()
      const stillExists = canvases.some((c) => c.id === selectedCanvasId)

      set({
        canvases,
        // never leave the selection dangling after a delete
        selectedCanvasId: stillExists ? selectedCanvasId : canvases[0]?.id ?? null,
      })
    } finally {
      set({ loading: false })
    }
  },

  selectCanvas: (id) => set({ selectedCanvasId: id }),

  createCanvas: async (name) => {
    const meta = await canvasService.create(name)
    await get().load()
    set({ selectedCanvasId: meta.id })
    return meta.id
  },

  renameCanvas: async (id, name) => {
    await canvasService.rename(id, name)
    await get().load()
  },

  deleteCanvas: async (id) => {
    await canvasService.remove(id)
    await get().load()
  },
}))

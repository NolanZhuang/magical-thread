import { create } from 'zustand';

// Central state. Every feature reads/writes here.
export const useStore = create((set, get) => ({
  objects: [],          // all SceneObjects on the canvas
  selectedIds: [],      // currently selected object ids
  activeToolId: null,   // which tool is active in the toolbar
  drawPreview: null,    // transient points for in-progress freehand drawing

  addObject: (obj) => set((s) => ({ objects: [...s.objects, obj] })),

  updateObject: (id, patch) =>
    set((s) => ({
      objects: s.objects.map((o) =>
        o.id === id ? { ...o, ...patch, data: { ...o.data, ...(patch.data || {}) } } : o
      ),
    })),

  removeObject: (id) =>
    set((s) => ({ objects: s.objects.filter((o) => o.id !== id) })),

  setActiveTool: (id) => set({ activeToolId: id }),

  select: (ids) => set({ selectedIds: ids }),

  getObject: (id) => get().objects.find((o) => o.id === id),

  setDrawPreview: (pts) => set({ drawPreview: pts }),
}));

import { create } from 'zustand'
import type { FurnitureCandidate } from './types'
type ReviewState = {
  key: string
  candidates: FurnitureCandidate[]
  selected: string | null
  shown: boolean
  begin: (key: string, candidates: FurnitureCandidate[]) => void
  patch: (id: string, change: Partial<FurnitureCandidate>) => void
  select: (id: string | null) => void
  remove: (id: string) => void
  consumeAccepted: () => void
  clear: () => void
  toggle: () => void
}
export const useFurnitureReview = create<ReviewState>((set) => ({
  key: '',
  candidates: [],
  selected: null,
  shown: true,
  begin: (key, candidates) => set({ key, candidates, selected: candidates[0]?.id || null }),
  patch: (id, change) =>
    set((state) => ({
      candidates: state.candidates.map((item) => (item.id === id ? { ...item, ...change } : item)),
    })),
  select: (selected) => set({ selected }),
  remove: (id) =>
    set((state) => ({
      candidates: state.candidates.filter((item) => item.id !== id),
      selected: state.selected === id ? null : state.selected,
    })),
  consumeAccepted: () =>
    set((state) => {
      const candidates = state.candidates.filter((item) => item.status !== 'accepted')
      return {
        candidates,
        selected: candidates.some((c) => c.id === state.selected)
          ? state.selected
          : candidates[0]?.id || null,
      }
    }),
  clear: () => set({ key: '', candidates: [], selected: null }),
  toggle: () => set((state) => ({ shown: !state.shown })),
}))

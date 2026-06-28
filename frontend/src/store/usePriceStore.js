import { create } from 'zustand'

/**
 * Global price filter state shared across Dashboard, Forecast, and CropExplorer.
 * Zustand store — no boilerplate, no providers.
 */
export const usePriceStore = create((set) => ({
  selectedCrop:  'Tomato',
  selectedState: null,
  dateRange:     { start: null, end: null },

  setSelectedCrop:  (crop)  => set({ selectedCrop: crop }),
  setSelectedState: (state) => set({ selectedState: state }),
  setDateRange:     (range) => set({ dateRange: range }),
  resetFilters: () => set({ selectedCrop: 'Tomato', selectedState: null, dateRange: { start: null, end: null } }),
}))

import { create } from 'zustand'

export const useForecastStore = create((set) => ({
  forecastResult: null,
  forecastParams: { crop: 'Tomato', state: null, days: 90, model: 'prophet' },
  isRunning: false,

  setForecastParams: (params) => set((s) => ({ forecastParams: { ...s.forecastParams, ...params } })),
  setForecastResult: (result) => set({ forecastResult: result }),
  setIsRunning:      (val)    => set({ isRunning: val }),
  clearForecast:     ()       => set({ forecastResult: null }),
}))

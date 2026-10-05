import { create } from 'zustand'

export const useFarmStore = create((set) => ({
  farms:       [],
  activeFarm:  null,
  healthScore: 75, // Default/fallback score
  alerts:      [],
  setFarms:      (farms) => set({ farms }),
  setActiveFarm: (farm)  => set({ activeFarm: farm }),
  updateHealth:  (score) => set({ healthScore: score }),
  addAlert: (a) => set(s => {
    // Avoid duplicate alert insertions by checking id or timestamp
    if (s.alerts.some(existing => existing.id === a.id)) {
      return {};
    }
    return { alerts: [a, ...s.alerts].slice(0, 50) };
  }),
  markAlertRead: (id) => set(s => ({
    alerts: s.alerts.map(a => a.id === id ? { ...a, is_read: true } : a)
  })),
  clearAlerts: () => set({ alerts: [] })
}))

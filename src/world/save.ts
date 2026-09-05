// localStorage save state. Saved on every soft pad landing and delivery;
// loaded on boot; death and "restart from pad" reload it.

export interface SaveData {
  version: 1
  padId: string
  upgrades: { engine: boolean; fueltank: boolean; grapple: boolean; weapon: boolean }
  itemsDelivered: string[]
  itemPositions: Record<string, { x: number; y: number }>
  barriersCleared: string[] // "tx,ty" cells (M5)
  bossDead: boolean // (M7)
}

const KEY = 'undertow-save-v1'

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Storage unavailable (private mode etc.) — play on without saves.
  }
}

export function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (data.version !== 1) return null
    return data
  } catch {
    return null
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

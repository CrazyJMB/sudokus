export type DateKey = string

/** Calendar dates, never UTC timestamps: the player's device defines “today”. */
export function todayKey(now = new Date()): DateKey {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function parseDateKey(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Fecha no válida')
  const [year, month, day] = value.split('-').map(Number)
  const result = new Date(0)
  result.setUTCHours(0, 0, 0, 0)
  result.setUTCFullYear(year!, month! - 1, day!)
  if (year! < 1 || result.getUTCFullYear() !== year || result.getUTCMonth() + 1 !== month || result.getUTCDate() !== day) {
    throw new Error('Fecha no válida')
  }
  return result
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') return false
  try { parseDateKey(value); return true } catch { return false }
}

export function dateKeyUTC(date: Date): DateKey {
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/** UTC arithmetic avoids skipping/doubling days at daylight-saving transitions. */
export function addDays(key: DateKey, amount: number): DateKey {
  const date = parseDateKey(key)
  date.setUTCDate(date.getUTCDate() + amount)
  return dateKeyUTC(date)
}

export function formatDate(key: DateKey, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }): string {
  return new Intl.DateTimeFormat('es-ES', { ...options, timeZone: 'UTC' }).format(parseDateKey(key))
}

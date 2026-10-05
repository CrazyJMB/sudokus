import { addDays, type DateKey } from './dates'
import type { Difficulty, Grid } from './sudoku'

export interface SavedGame {
  date: DateKey
  difficulty: Difficulty
  values: Grid
  notes: number[] // nine-bit masks (bits 1..9)
  startedAt: string
  completedAt: string | null
  completedOn: DateKey | null
}

/** Historical completions never enter this set, even if completed today. */
export function creditedDays(games: Iterable<SavedGame>): Set<DateKey> {
  return new Set([...games].filter(game => game.completedAt && game.completedOn === game.date).map(game => game.date))
}

export function streaks(games: Iterable<SavedGame>, today: DateKey): { current: number; best: number } {
  const days = [...creditedDays(games)].filter(day => day <= today).sort()
  const completed = new Set(days)
  let cursor = completed.has(today) ? today : addDays(today, -1)
  let current = 0
  while (completed.has(cursor)) { current++; cursor = addDays(cursor, -1) }
  let best = 0, run = 0, previous: DateKey | null = null
  for (const day of days) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1
    best = Math.max(best, run); previous = day
  }
  return { current, best }
}

export function dayStatus(games: Iterable<SavedGame>, date: DateKey): 'completed' | 'progress' | 'empty' {
  const matches = [...games].filter(game => game.date === date)
  if (matches.some(game => game.completedAt)) return 'completed'
  return matches.length ? 'progress' : 'empty'
}

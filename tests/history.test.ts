import { describe, expect, it } from 'vitest'
import { creditedDays, dayStatus, streaks, type SavedGame } from '../src/lib/history'
import type { Difficulty } from '../src/lib/sudoku'

function game(date: string, completedOn: string | null = date, difficulty: Difficulty = 'easy'): SavedGame {
  return { date, difficulty, values: Array<number>(81).fill(1), notes: Array<number>(81).fill(0), startedAt: `${date}T09:00:00Z`, completedAt: completedOn ? `${completedOn}T10:00:00Z` : null, completedOn }
}

describe('rachas e historial', () => {
  it('cuenta un día como máximo, aunque completes tres dificultades', () => {
    const games = [game('2026-10-01'), game('2026-10-02'), game('2026-10-02', '2026-10-02', 'medium'), game('2026-10-02', '2026-10-02', 'hard')]
    expect(creditedDays(games).size).toBe(2)
    expect(streaks(games, '2026-10-02')).toEqual({ current: 2, best: 2 })
  })

  it('completar días antiguos no amplía ni repara una racha', () => {
    const before = [game('2026-09-29'), game('2026-10-01'), game('2026-10-02')]
    const after = [...before, game('2026-09-30', '2026-10-02')]
    expect(streaks(after, '2026-10-02')).toEqual(streaks(before, '2026-10-02'))
    expect(streaks(after, '2026-10-02').current).toBe(2)
    expect(dayStatus(after, '2026-09-30')).toBe('completed')
  })

  it('mantiene la racha de ayer mientras hoy está pendiente; un día omitido la rompe', () => {
    const games = [game('2026-09-30'), game('2026-10-01')]
    expect(streaks(games, '2026-10-02')).toEqual({ current: 2, best: 2 })
    expect(streaks(games, '2026-10-03')).toEqual({ current: 0, best: 2 })
    expect(streaks([...games, game('2026-10-02', '2026-10-03')], '2026-10-03')).toEqual({ current: 0, best: 2 })
  })

  it('distingue partidas sin empezar, en curso y completadas', () => {
    expect(dayStatus([], '2026-10-02')).toBe('empty')
    expect(dayStatus([game('2026-10-02', null)], '2026-10-02')).toBe('progress')
    expect(streaks([], '2026-10-02')).toEqual({ current: 0, best: 0 })
  })
})

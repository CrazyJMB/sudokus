import { describe, expect, it } from 'vitest'
import { analyzeSudoku, candidateMask, countSolutions, DIFFICULTIES, DIFFICULTY_PROFILES, findConflicts, generateSudoku, isSolved, rateSudoku, searchSolutions, solveSudoku, UNITS } from '../src/domain/sudoku'
import { addDays, isDateKey, todayKey } from '../src/domain/dates'

describe('motor diario', () => {
  it('reproduce exactamente un tablero por fecha y dificultad', () => {
    const first = generateSudoku('2026-10-02', 'medium')
    expect(generateSudoku('2026-10-02', 'medium')).toEqual(first)
    expect(generateSudoku('2026-10-03', 'medium').givens).not.toEqual(first.givens)
    expect(generateSudoku('2026-10-02', 'hard').givens).not.toEqual(first.givens)
  })

  it('genera soluciones únicas y la dificultad declarada en distintas fechas', () => {
    const dates = ['2020-01-01', '2024-02-29', '2026-03-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-25', '2026-12-31', '2027-01-01', '2028-02-29', '2030-06-15', '2040-11-30']
    const expected = { easy: 'singles', medium: 'pairs-and-locked', hard: 'advanced' }
    let slowest = 0
    for (const date of dates) for (const difficulty of DIFFICULTIES) {
      const start = performance.now()
      const puzzle = generateSudoku(date, difficulty)
      slowest = Math.max(slowest, performance.now() - start)
      expect(countSolutions(puzzle.givens), `${date} ${difficulty}`).toBe(1)
      expect(rateSudoku(puzzle.givens)).toBe(expected[difficulty])
      const analysis = analyzeSudoku(puzzle.givens)
      expect(analysis).toEqual(puzzle.analysis)
      expect(analysis.valid).toBe(true)
      expect(analysis.solved).toBe(true)
      expect(analysis.board).toEqual(puzzle.solution)
      const profile = DIFFICULTY_PROFILES[difficulty]
      expect(analysis.maxRank).toBeGreaterThanOrEqual(profile.minimumRank)
      expect(analysis.maxRank).toBeLessThanOrEqual(profile.maximumRank)
      expect(puzzle.clues).toBeGreaterThanOrEqual(profile.minimumClues)
      expect(puzzle.clues).toBeLessThanOrEqual(profile.targetClues)
      for (const step of analysis.steps) {
        for (const placement of step.placements) expect(placement.digit).toBe(puzzle.solution[placement.index])
        for (const removal of step.eliminations) expect(removal.digits).not.toContain(puzzle.solution[removal.index])
      }
      expect(solveSudoku(puzzle.givens)).toEqual(puzzle.solution)
      expect(puzzle.givens.every((v, i) => v === 0 || v === puzzle.solution[i])).toBe(true)
      for (const unit of UNITS) expect(unit.map(i => puzzle.solution[i]).sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
      expect(isSolved(puzzle.solution, puzzle)).toBe(true)
      expect(isSolved(puzzle.givens, puzzle)).toBe(false)
    }
    console.info(`36 tableros únicos comprobados. Generación más lenta: ${Math.round(slowest)} ms.`)
  }, 60_000)

  it('rechaza fechas imposibles y tableros corruptos', () => {
    expect(() => generateSudoku('2026-02-29', 'easy')).toThrow()
    expect(() => generateSudoku('2026-13-01', 'easy')).toThrow()
    expect(() => countSolutions([1, 2, 3])).toThrow()
    const invalid = Array<number>(81).fill(0); invalid[0] = invalid[1] = 1
    expect(countSolutions(invalid)).toBe(0)
    expect(findConflicts(invalid)).toEqual(new Set([0, 1]))
    expect(analyzeSudoku(invalid)).toMatchObject({ valid: false, solved: false, rating: null })
    expect(rateSudoku(invalid)).toBeNull()
    expect(() => generateSudoku('2026-10-02', 'invalid' as 'easy')).toThrow('Invalid difficulty')
    for (const limit of [0, -1, 1.5, NaN, Infinity]) expect(() => countSolutions(Array(81).fill(0), limit)).toThrow()
    for (const index of [-1, 81, 0.5, NaN]) expect(() => candidateMask(Array(81).fill(0), index)).toThrow()
  })

  it('limita la búsqueda, no modifica la entrada y distingue un bloqueo lógico de una solución', () => {
    const empty = Object.freeze(Array<number>(81).fill(0))
    expect(analyzeSudoku(empty)).toMatchObject({ valid: true, solved: false, steps: [], rating: null })
    expect(rateSudoku(empty)).toBeNull()
    expect(countSolutions(empty)).toBe(2)
    const solutions = searchSolutions(empty)
    expect(solutions).toHaveLength(2)
    expect(solutions[0]).not.toEqual(solutions[1])
    expect(isSolved(solutions[0]!)).toBe(true)
    expect(isSolved(empty)).toBe(false)
    expect(isSolved(Array(81))).toBe(false)
    expect(isSolved(Array(81), { solution: solutions[0]! })).toBe(false)
  })

  it('no asigna dificultad a un tablero que sigue bloqueado después de algunas deducciones', () => {
    const grid = Array<number>(81).fill(0)
    grid.splice(0, 8, 1, 2, 3, 4, 5, 6, 7, 8)
    const analysis = analyzeSudoku(grid)
    expect(analysis.steps.length).toBeGreaterThan(0)
    expect(analysis.maxRank).toBeGreaterThan(0)
    expect(analysis).toMatchObject({ valid: true, solved: false, rating: null })
    expect(rateSudoku(grid)).toBeNull()
    expect(grid[8]).toBe(0)
  })

  it('usa una plantilla difícil determinista y verificada si se agotan los intentos', () => {
    const attempts = DIFFICULTY_PROFILES.hard.maximumAttempts
    try {
      DIFFICULTY_PROFILES.hard.maximumAttempts = 0
      const puzzle = generateSudoku('2026-10-06', 'hard')
      expect(generateSudoku('2026-10-06', 'hard')).toEqual(puzzle)
      expect(puzzle.rating).toBe('advanced')
      expect(puzzle.analysis.solved).toBe(true)
      expect(puzzle.analysis.board).toEqual(puzzle.solution)
      expect(countSolutions(puzzle.givens)).toBe(1)
    } finally { DIFFICULTY_PROFILES.hard.maximumAttempts = attempts }
  })
})

describe('fechas civiles', () => {
  it('respeta años bisiestos, cambios de año y límites de horario de verano', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-29', -1)).toBe('2026-03-28')
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26')
    expect(addDays('0099-12-31', 1)).toBe('0100-01-01')
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(todayKey(new Date(2026, 9, 2, 0, 1))).toBe('2026-10-02')
  })
})

import { describe, expect, it } from 'vitest'
import { countSolutions, DIFFICULTIES, findConflicts, generateSudoku, isSolved, rateSudoku, solveSudoku, UNITS } from '../src/domain/sudoku'
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

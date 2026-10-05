import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { DIFFICULTIES, generateSudoku } from '../src/domain/sudoku'
import { getLogicalHint } from '../src/domain/sudoku/hints'
import { useLogicalHints } from '../src/composables/useLogicalHints'

const solved = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'.split('').map(Number)

describe('pistas por deducción', () => {
  it('explica la intersección de candidatos sin modificar el tablero', () => {
    const grid = [...solved]; grid[0] = 0
    Object.freeze(grid)
    const hint = getLogicalHint(grid)
    expect(hint.status).toBe('placement')
    expect(hint.placement).toEqual({ cell: 0, digit: 5 })
    expect(hint.steps[0]!.explanation).toContain('fila 1')
    expect(hint.steps[0]!.explanation).toContain('columna 1')
    expect(hint.steps[0]!.explanation).toContain('intersección')
    expect(grid[0]).toBe(0)
  })
  it('detecta entradas inválidas, repeticiones y tableros completos', () => {
    expect(getLogicalHint([1]).status).toBe('invalid')
    expect(getLogicalHint(Array(81)).status).toBe('invalid')
    expect(getLogicalHint([...solved.slice(0, 80), 10]).status).toBe('invalid')
    const duplicate = [...solved]; duplicate[0] = duplicate[1]!
    const hint = getLogicalHint(duplicate)
    expect(hint.status).toBe('invalid'); expect(hint.cells).toContain(0)
    expect(getLogicalHint(solved).status).toBe('complete')
  })
  it('detecta contradicciones aunque no haya números repetidos', () => {
    const grid = Array<number>(81).fill(0)
    for (let i = 0; i < 8; i++) grid[i] = i + 1
    grid[17] = 9
    expect(getLogicalHint(grid).status).toBe('invalid')
    grid.fill(0)
    for (let i = 0; i < 7; i++) grid[i] = i + 1
    grid[34] = 8; grid[62] = 8
    const hint = getLogicalHint(grid)
    expect(hint.status).toBe('invalid')
    expect(hint.message).toContain('8 no puede colocarse')
  })
  it('no inventa una solución para un tablero vacío', () => {
    const hint = getLogicalHint(Array<number>(81).fill(0))
    expect(hint.status).toBe('stuck')
    expect(hint.placement).toBeUndefined()
    expect(hint.steps).toHaveLength(0)
  })
  it('invalida la explicación en cuanto cambia un número', () => {
    const values = ref([...solved]); values.value[0] = 0
    const { hint, highlightedCells, requestHint } = useLogicalHints(computed(() => values.value))
    requestHint(); expect(highlightedCells.value).toEqual([0])
    values.value[0] = 5
    expect(hint.value).toBeNull(); expect(highlightedCells.value).toEqual([])
  })
  it.each([
    ['x-wing', '000005000081200060045300290060820004000056002050710609010602940020000700093570820', '972165438381294567645387291167829354839456172254713689718632945526948713493571826'],
    ['hidden-pair', '000240105080013090100009300000126907000700803700300206001400000020900000450000030', '963248175287513694145679328538126947612794853794385216871432569326957481459861732'],
  ])('explica %s y conserva los candidatos de la solución', (technique, input, solution) => {
    const hint = getLogicalHint(input.split('').map(Number))
    expect(hint.status).not.toBe('invalid')
    expect(hint.steps.some(step => step.technique === technique)).toBe(true)
    for (const step of hint.steps) for (const removal of step.eliminations) {
      expect(removal.digits).not.toContain(Number(solution[removal.cell]))
      expect(step.explanation).toContain('Se descarta')
    }
    if (hint.placement) expect(hint.placement.digit).toBe(Number(solution[hint.placement.cell]))
  })
  it('todas las colocaciones y eliminaciones respetan la solución de tableros reales', () => {
    const used = new Set<string>()
    for (const level of DIFFICULTIES) for (const date of ['2024-02-29', '2026-10-01', '2026-10-02', '2026-10-05']) {
      const puzzle = generateSudoku(date, level), grid = [...puzzle.givens]
      for (let move = 0; move < 81; move++) {
        const hint = getLogicalHint(grid)
        expect(hint.status).not.toBe('invalid')
        for (const step of hint.steps) {
          used.add(step.technique)
          for (const elimination of step.eliminations) expect(elimination.digits).not.toContain(puzzle.solution[elimination.cell])
        }
        if (!hint.placement) break
        expect(grid[hint.placement.cell]).toBe(0)
        expect(hint.placement.digit).toBe(puzzle.solution[hint.placement.cell])
        grid[hint.placement.cell] = hint.placement.digit
      }
      if (level !== 'hard') expect(grid).toEqual(puzzle.solution)
    }
    expect(used.has('single')).toBe(true)
    expect(used.has('hidden-single')).toBe(true)
    expect(used.has('locked')).toBe(true)
    expect(used.has('naked-pair')).toBe(true)
  })
})

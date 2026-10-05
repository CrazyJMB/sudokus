import { BOXES, COLUMNS, ROWS, UNITS, candidateMask, findConflicts, type Grid } from './index'
import { cellName, findEasyHint } from './easy-hints'
export { cellName } from './easy-hints'

export type HintTechnique = 'single' | 'hidden-single' | 'locked' | 'naked-pair' | 'hidden-pair' | 'x-wing'
export interface HintStep {
  technique: HintTechnique
  title: string
  explanation: string
  cells: number[]
  eliminations: Array<{ cell: number; digits: number[] }>
}
export interface LogicalHint {
  status: 'placement' | 'elimination' | 'invalid' | 'complete' | 'stuck'
  message: string
  steps: HintStep[]
  candidates: number[][]
  cells: number[]
  placement?: { cell: number; digit: number }
  guidance?: HintGuidance
}

export interface HintGuidance {
  prompt: string
  nudge: string
  cells: number[]
  nudgeCells: number[]
}

const digits = (mask: number) => Array.from({ length: 9 }, (_, i) => i + 1).filter(n => mask & (1 << n))
const unitName = (index: number) => index < 9 ? `fila ${index + 1}` : index < 18 ? `columna ${index - 8}` : `bloque ${index - 17}`
const positions = (cells: number[]) => cells.map(cellName).join(', ')

/** Pure logical deductions from the visible numbers. Never reads a solution or uses search. */
export function getLogicalHint(grid: Grid): LogicalHint {
  const steps: HintStep[] = []
  const masks = Array<number>(81).fill(0)
  const result = (status: LogicalHint['status'], message: string, cells: number[] = [], placement?: LogicalHint['placement']): LogicalHint => ({
    status, message, cells, placement, steps: [...steps], candidates: masks.map(digits),
    guidance: (status === 'placement' || status === 'elimination') && steps.length ? {
      prompt: 'No veo una jugada directa. Hay una deducción que necesita varios pasos; puedes explorarla si quieres.',
      nudge: steps[0]!.technique === 'locked' ? 'En la zona señalada, busca un número cuyos huecos posibles estén todos en una misma fila o columna.' : steps[0]!.technique === 'naked-pair' || steps[0]!.technique === 'hidden-pair' ? 'En la zona señalada, busca dos casillas que se puedan reservar para los mismos dos números.' : 'Esta pista necesita comparar varias filas o columnas. Puedes pedir la explicación completa cuando quieras.',
      cells: [...steps[0]!.cells], nudgeCells: [...steps[0]!.cells],
    } : undefined,
  })
  if (grid.length !== 81 || Array.from(grid).some(n => !Number.isInteger(n) || n < 0 || n > 9)) {
    return result('invalid', 'El tablero debe tener 81 casillas con números del 1 al 9 o casillas vacías.')
  }
  const conflicts = [...findConflicts(grid)]
  if (conflicts.length) return result('invalid', `Hay números repetidos en una fila, columna o bloque. Revisa ${positions(conflicts)}.`, conflicts)
  if (grid.every(Boolean)) return result('complete', 'El tablero está completo y respeta todas las reglas del sudoku.')
  grid.forEach((value, i) => { masks[i] = value ? 0 : candidateMask(grid, i) })

  function eliminate(technique: HintTechnique, title: string, reason: string, sources: number[], targets: number[], mask: number): boolean {
    const eliminations = targets.filter(i => masks[i]! & mask).map(cell => ({ cell, digits: digits(masks[cell]! & mask) }))
    if (!eliminations.length) return false
    for (const { cell } of eliminations) masks[cell]! &= ~mask
    steps.push({ technique, title, explanation: `${reason} Se descarta ${eliminations.map(e => `${e.digits.join('/')} en ${cellName(e.cell)}`).join('; ')}.`, cells: sources, eliminations })
    return true
  }

  // Each pass returns a placement or removes at least one of the 729 candidates.
  for (let pass = 0; pass <= 729; pass++) {
    const impossible = grid.flatMap((value, i) => !value && !masks[i] ? [i] : [])
    if (impossible.length) return result('invalid', `No queda ningún candidato en ${positions(impossible)}. Revisa los números introducidos.`, impossible)
    for (const [u, unit] of UNITS.entries()) {
      for (let digit = 1; digit <= 9; digit++) {
        if (!unit.some(i => grid[i] === digit) && !unit.some(i => masks[i]! & (1 << digit))) {
          return result('invalid', `El ${digit} no puede colocarse en ninguna casilla de la ${unitName(u)}. Revisa sus números y los que la cruzan.`, [...unit])
        }
      }
    }

    if (!steps.length) {
      const easy = findEasyHint(grid, masks)
      if (easy) {
        steps.push(easy.step)
        return { ...result('placement', `En ${cellName(easy.cell)} solo puede ir el ${easy.digit}.`, [easy.cell], { cell: easy.cell, digit: easy.digit }), guidance: easy.guidance }
      }
    }

    for (let cell = 0; cell < 81; cell++) {
      const remaining = digits(masks[cell]!)
      if (remaining.length !== 1) continue
      const row = ROWS[Math.floor(cell / 9)]!, col = COLUMNS[cell % 9]!
      const box = BOXES[Math.floor(cell / 27) * 3 + Math.floor(cell % 9 / 3)]!
      const missing = (unit: number[]) => digits(0b1111111110 & ~unit.reduce((m, i) => m | (1 << grid[i]!), 0)).join(', ')
      const digit = remaining[0]!
      steps.push({ technique: 'single', title: 'Un solo candidato', cells: [cell], eliminations: [], explanation: `En la fila ${Math.floor(cell / 9) + 1} faltan {${missing(row)}}; en la columna ${cell % 9 + 1}, {${missing(col)}}; en su bloque, {${missing(box)}}. ${steps.length ? 'Al cruzar estos conjuntos y aplicar las eliminaciones anteriores' : 'La intersección de estos tres conjuntos'} solo deja el ${digit} en ${cellName(cell)}.` })
      return result('placement', `En ${cellName(cell)} solo puede ir el ${digit}.`, [cell], { cell, digit })
    }
    for (const [u, unit] of UNITS.entries()) for (let digit = 1; digit <= 9; digit++) {
      const cells = unit.filter(i => masks[i]! & (1 << digit))
      if (cells.length !== 1) continue
      const cell = cells[0]!
      steps.push({ technique: 'hidden-single', title: 'Un único lugar', cells: [...unit], eliminations: [], explanation: `El ${digit} falta en la ${unitName(u)}. Al excluir casillas ocupadas y las que no admiten ese número por su fila, columna o bloque${steps.length ? ', y aplicar las eliminaciones anteriores,' : ','} solo queda ${cellName(cell)}. Aunque esa casilla tenga otros candidatos, el ${digit} tiene que ir ahí.` })
      return result('placement', `El ${digit} solo tiene un lugar en la ${unitName(u)}: ${cellName(cell)}.`, [cell], { cell, digit })
    }

    let changed = false
    // Pointing and claiming: a digit confined to the intersection of two units.
    outerLocked: for (const [u, unit] of UNITS.entries()) for (let digit = 1; digit <= 9; digit++) {
      const cells = unit.filter(i => masks[i]! & (1 << digit))
      if (cells.length < 2) continue
      for (const [v, other] of UNITS.entries()) {
        if (u === v || !cells.every(i => other.includes(i))) continue
        if (eliminate('locked', 'Candidatos bloqueados', `En la ${unitName(u)}, el ${digit} solo cabe en ${positions(cells)}. Todas esas casillas pertenecen también a la ${unitName(v)}: el ${digit} estará en esa intersección y no puede repetirse fuera de ella.`, cells, other.filter(i => !unit.includes(i)), 1 << digit)) {
          changed = true; break outerLocked
        }
      }
    }
    if (changed) continue

    outerPairs: for (const [u, unit] of UNITS.entries()) {
      for (const cell of unit) {
        const mask = masks[cell]!
        if (digits(mask).length !== 2) continue
        const pair = unit.filter(i => masks[i] === mask)
        if (pair.length !== 2) continue
        if (eliminate('naked-pair', 'Dos números, dos casillas', `En la ${unitName(u)}, ${positions(pair)} tienen exactamente los candidatos {${digits(mask).join(', ')}}. Esos dos números ocuparán esas dos casillas, en algún orden, y quedan excluidos de las demás.`, pair, unit.filter(i => !pair.includes(i)), mask)) {
          changed = true; break outerPairs
        }
      }
      for (let a = 1; a < 9; a++) for (let b = a + 1; b <= 9; b++) {
        const first = unit.filter(i => masks[i]! & (1 << a)), second = unit.filter(i => masks[i]! & (1 << b))
        if (first.length !== 2 || second.length !== 2 || !first.every(i => second.includes(i))) continue
        if (eliminate('hidden-pair', 'Pareja oculta', `En la ${unitName(u)}, tanto el ${a} como el ${b} solo pueden ir en ${positions(first)}. Estas dos casillas se reservan para {${a}, ${b}}.`, first, first, 0b1111111110 & ~((1 << a) | (1 << b)))) {
          changed = true; break outerPairs
        }
      }
    }
    if (changed) continue

    outerWing: for (const orientation of [0, 1]) {
      const units = orientation === 0 ? ROWS : COLUMNS
      const cross = orientation === 0 ? COLUMNS : ROWS
      const crossIndex = (i: number) => orientation === 0 ? i % 9 : Math.floor(i / 9)
      for (let digit = 1; digit <= 9; digit++) for (let a = 0; a < 8; a++) for (let b = a + 1; b < 9; b++) {
        const first = units[a]!.filter(i => masks[i]! & (1 << digit)), second = units[b]!.filter(i => masks[i]! & (1 << digit))
        if (first.length !== 2 || second.length !== 2 || first.some((i, j) => crossIndex(i) !== crossIndex(second[j]!))) continue
        const sources = [...first, ...second]
        const targets = [...cross[crossIndex(first[0]!)]!, ...cross[crossIndex(first[1]!)]!].filter(i => !sources.includes(i))
        if (eliminate('x-wing', 'Rectángulo de candidatos (X-Wing)', `En las ${orientation === 0 ? 'filas' : 'columnas'} ${a + 1} y ${b + 1}, el ${digit} solo puede ir en ${positions(sources)}. Al ocupar esquinas opuestas, habrá un ${digit} en cada una de las dos ${orientation === 0 ? 'columnas' : 'filas'} que las cruzan.`, sources, targets, 1 << digit)) {
          changed = true; break outerWing
        }
      }
    }
    if (changed) continue
    return steps.length
      ? result('elimination', 'Puedes descartar estos candidatos. Todavía no se deduce un número con las técnicas disponibles.', [...new Set(steps.flatMap(s => s.eliminations.map(e => e.cell)))])
      : result('stuck', 'No encuentro una deducción con candidatos únicos, pares, candidatos bloqueados o X-Wing. Puede hacer falta una técnica más avanzada o introducir más números del original.')
  }
  return result('stuck', 'No se encontró una nueva deducción.')
}

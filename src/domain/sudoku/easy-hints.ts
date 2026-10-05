import { UNITS, boxOf, type Grid } from './index'
import type { HintGuidance, HintStep } from './hints'

export const cellName = (cell: number) => `F${Math.floor(cell / 9) + 1} C${cell % 9 + 1}`

const numbers = (mask: number) => Array.from({ length: 9 }, (_, i) => i + 1).filter(n => mask & (1 << n))
const join = (items: Array<string | number>) => items.length < 2 ? String(items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
const sees = (a: number, b: number) => Math.floor(a / 9) === Math.floor(b / 9) || a % 9 === b % 9 || boxOf(a) === boxOf(b)
const boxes = ['de arriba a la izquierda', 'de arriba en el centro', 'de arriba a la derecha', 'del centro a la izquierda', 'central', 'del centro a la derecha', 'de abajo a la izquierda', 'de abajo en el centro', 'de abajo a la derecha']
const area = (u: number) => u < 9 ? `la fila ${u + 1}` : u < 18 ? `la columna ${u - 8}` : `el bloque ${boxes[u - 18]}`

interface EasyHint {
  cell: number
  digit: number
  score: number
  guidance: HintGuidance
  step: HintStep
}

/** Prefer a short visible proof, rather than the first forced cell in reading order. */
export function findEasyHint(grid: Grid, masks: number[]): EasyHint | undefined {
  const choices: EasyHint[] = []
  for (const [u, unit] of UNITS.entries()) {
    const empty = unit.filter(i => !grid[i])
    const missing = numbers(0b1111111110 & ~unit.reduce((mask, i) => mask | (1 << grid[i]!), 0))
    if (!empty.length) continue
    for (const cell of empty) {
      const candidates = numbers(masks[cell]!)
      if (candidates.length !== 1) continue
      const digit = candidates[0]!
      const alternatives = missing.filter(n => n !== digit)
      const witnesses = alternatives.map(n => grid.findIndex((value, i) => value === n && sees(cell, i)))
      if (witnesses.some(i => i < 0)) continue
      const onlyOne = empty.length === 1
      choices.push({
        cell, digit, score: onlyOne ? 0 : 8 + alternatives.length * 12 + empty.length / 100,
        guidance: {
          prompt: onlyOne ? `Mira ${area(u)}: solo queda un hueco. Repasa del 1 al 9 y busca el número que falta.` : `Mira ${area(u)}. Hay un hueco que puedes completar probando los números que faltan.`,
          nudge: onlyOne ? 'Comprueba qué número del 1 al 9 todavía no aparece en esa zona.' : `Fíjate en ${cellName(cell)}. En ${area(u)} faltan ${join(missing)}. Comprueba cuáles ya aparecen en la fila, columna o bloque de esa casilla.`,
          cells: [...unit], nudgeCells: [...new Set([...unit, ...witnesses])],
        },
        step: { technique: 'single', title: onlyOne ? 'Completar el último hueco' : 'Probar los números que faltan', cells: [cell], eliminations: [], explanation: onlyOne
          ? `En ${area(u)} solo falta el ${digit}. Por eso va en ${cellName(cell)}.`
          : `En ${area(u)} faltan ${join(missing)}. Para ${cellName(cell)}, ${alternatives.map((n, i) => `el ${n} se descarta por el ${n} de ${cellName(witnesses[i]!)}`).join('; ')}. Queda el ${digit}.` },
      })
    }
    for (const digit of missing) {
      const places = empty.filter(i => masks[i]! & (1 << digit))
      if (places.length !== 1 || empty.length === 1) continue
      const cell = places[0]!, excluded = empty.filter(i => i !== cell)
      const witnesses = grid.flatMap((value, i) => value === digit && excluded.some(j => sees(i, j)) ? [i] : [])
      // At most nine occurrences of a digit. Find the smallest visible set that blocks all other holes.
      let proof: number[] | undefined
      for (let subset = 1; subset < (1 << witnesses.length); subset++) {
        const selected = witnesses.filter((_, i) => subset & (1 << i))
        if (proof && selected.length >= proof.length) continue
        if (excluded.every(i => selected.some(j => sees(i, j)))) proof = selected
      }
      if (!proof) continue
      let nudge = `Fíjate en ${join(proof.map(cellName))}: ya tienen un ${digit}. Descarta los huecos de ${area(u)} que comparten fila, columna o bloque con ellos. ¿Cuál queda libre?`
      if (u >= 18) {
        const blockedRows = [...new Set(proof.filter(i => unit.some(j => Math.floor(i / 9) === Math.floor(j / 9))).map(i => Math.floor(i / 9) + 1))].sort((a, b) => a - b)
        const blockedColumns = [...new Set(proof.filter(i => unit.some(j => i % 9 === j % 9)).map(i => i % 9 + 1))].sort((a, b) => a - b)
        const lines = [...(blockedRows.length ? [`${blockedRows.length === 1 ? 'la fila' : 'las filas'} ${join(blockedRows)}`] : []), ...(blockedColumns.length ? [`${blockedColumns.length === 1 ? 'la columna' : 'las columnas'} ${join(blockedColumns)}`] : [])]
        nudge = `En ${join(lines)} ya hay un ${digit}. Descarta esos huecos de ${area(u)}. ¿Cuál queda libre?`
      }
      choices.push({
        cell, digit, score: proof.length * 10 + (u >= 18 ? 0 : 3) + empty.length / 100,
        guidance: { prompt: `Mira ${area(u)}. Busca dónde puede ir el ${digit}.`, nudge, cells: [...unit], nudgeCells: [...unit, ...proof] },
        step: { technique: 'hidden-single', title: 'Descartar huecos con un mismo número', cells: [...unit, ...proof], eliminations: [], explanation: `${nudge.split(' Descarta')[0]} Esos ${digit} bloquean los demás huecos de ${area(u)}. Solo queda ${cellName(cell)} para colocar el ${digit}.` },
      })
    }
  }
  return choices.sort((a, b) => a.score - b.score)[0]
}

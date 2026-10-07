import type { Grid } from './types'

export const GRID_SIZE = 9
export const CELL_COUNT = GRID_SIZE * GRID_SIZE
export const BOX_SIZE = 3
export const ALL_DIGITS_MASK = 0b1111111110

export const ROWS: number[][] = Array.from({ length: GRID_SIZE }, (_, row) =>
  Array.from({ length: GRID_SIZE }, (_, column) => row * GRID_SIZE + column),
)

export const COLUMNS: number[][] = Array.from({ length: GRID_SIZE }, (_, column) =>
  Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + column),
)

export const BOXES: number[][] = Array.from({ length: GRID_SIZE }, (_, box) => {
  const boxRow = Math.floor(box / BOX_SIZE)
  const boxColumn = box % BOX_SIZE

  return Array.from({ length: GRID_SIZE }, (_, offset) => {
    const row = boxRow * BOX_SIZE + Math.floor(offset / BOX_SIZE)
    const column = boxColumn * BOX_SIZE + (offset % BOX_SIZE)
    return row * GRID_SIZE + column
  })
})

export const UNITS = [...ROWS, ...COLUMNS, ...BOXES]

export function boxOf(index: number): number {
  const row = Math.floor(index / GRID_SIZE)
  const column = index % GRID_SIZE
  return Math.floor(row / BOX_SIZE) * BOX_SIZE + Math.floor(column / BOX_SIZE)
}

/** Peer cells share a row, column or box with the target cell. */
export const PEERS: number[][] = Array.from({ length: CELL_COUNT }, (_, index) => {
  const peerSet = new Set<number>()
  const row = Math.floor(index / GRID_SIZE)
  const column = index % GRID_SIZE

  for (const peer of ROWS[row]!) peerSet.add(peer)
  for (const peer of COLUMNS[column]!) peerSet.add(peer)
  for (const peer of BOXES[boxOf(index)]!) peerSet.add(peer)

  peerSet.delete(index)
  return [...peerSet]
})

export function bitCount(mask: number): number {
  let count = 0
  let value = mask

  while (value !== 0) {
    value &= value - 1
    count += 1
  }

  return count
}

export function digitMask(digit: number): number {
  return 1 << digit
}

export function digitsFromMask(mask: number): number[] {
  const digits: number[] = []

  for (let digit = 1; digit <= GRID_SIZE; digit += 1) {
    if ((mask & digitMask(digit)) !== 0) digits.push(digit)
  }

  return digits
}

export function onlyDigit(mask: number): number | null {
  if (bitCount(mask) !== 1) return null
  return digitsFromMask(mask)[0] ?? null
}

export function assertGrid(grid: readonly number[]): asserts grid is Grid {
  if (grid.length !== CELL_COUNT) {
    throw new Error(`A Sudoku grid must contain ${CELL_COUNT} cells.`)
  }

  for (const value of grid) {
    if (!Number.isInteger(value) || value < 0 || value > GRID_SIZE) {
      throw new Error('A Sudoku cell must be an integer from 0 to 9.')
    }
  }
}

/** Returns false when the givens contain a repeated digit in a unit. */
export function isValidGrid(grid: readonly number[]): boolean {
  try {
    assertGrid(grid)
  } catch {
    return false
  }

  for (const unit of UNITS) {
    let seen = 0

    for (const index of unit) {
      const digit = grid[index]!
      if (digit === 0) continue

      const bit = digitMask(digit)
      if ((seen & bit) !== 0) return false
      seen |= bit
    }
  }

  return true
}

/** Candidate mask based only on the current board (no advanced eliminations). */
export function candidateMask(grid: readonly number[], index: number): number {
  assertGrid(grid)

  if (!Number.isInteger(index) || index < 0 || index >= CELL_COUNT) {
    throw new Error(`Cell index must be between 0 and ${CELL_COUNT - 1}.`)
  }

  if (grid[index] !== 0) return 0

  let used = 0
  for (const peer of PEERS[index]!) {
    const digit = grid[peer]!
    if (digit !== 0) used |= digitMask(digit)
  }

  return ALL_DIGITS_MASK & ~used
}

export function isSolved(grid: readonly number[]): boolean {
  return grid.every((value) => value !== 0) && isValidGrid(grid)
}

export function findConflicts(grid: readonly number[]): Set<number> {
  assertGrid(grid)
  const conflicts = new Set<number>()

  for (const unit of UNITS) {
    const byDigit = new Map<number, number[]>()

    for (const index of unit) {
      const digit = grid[index]!
      if (digit === 0) continue
      const cells = byDigit.get(digit) ?? []
      cells.push(index)
      byDigit.set(digit, cells)
    }

    for (const cells of byDigit.values()) {
      if (cells.length > 1) cells.forEach((index) => conflicts.add(index))
    }
  }

  return conflicts
}

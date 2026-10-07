import {
  ALL_DIGITS_MASK,
  BOXES,
  CELL_COUNT,
  COLUMNS,
  PEERS,
  ROWS,
  UNITS,
  assertGrid,
  bitCount,
  boxOf,
  digitMask,
  digitsFromMask,
  onlyDigit,
} from './board'
import type {
  CandidateElimination,
  CellPlacement,
  Grid,
  Rating,
  SolveAnalysis,
  SolveStep,
  Technique,
} from './types'
import { shuffle, type Random } from '../utils/random'

export const TECHNIQUE_RANK: Record<Technique, number> = {
  'naked-single': 1,
  'hidden-single': 2,
  'locked-candidates': 3,
  'naked-pair': 4,
  'hidden-pair': 4,
  'naked-triple': 5,
  'hidden-triple': 5,
  'x-wing': 6,
}

interface CandidateState {
  board: Grid
  candidates: number[]
  contradiction: boolean
}

interface StrategyResult {
  technique: Technique
  placements?: CellPlacement[]
  eliminations?: CandidateElimination[]
}

interface CandidateStateResult {
  state: CandidateState | null
  valid: boolean
}

function ratingForRank(rank: number): Rating {
  if (rank <= 2) return 'singles'
  if (rank <= 4) return 'pairs-and-locked'
  return 'advanced'
}

function createCandidateState(grid: readonly number[]): CandidateStateResult {
  assertGrid(grid)
  const board = [...grid]
  const rowMasks = Array.from({ length: 9 }, () => 0)
  const columnMasks = Array.from({ length: 9 }, () => 0)
  const boxMasks = Array.from({ length: 9 }, () => 0)

  for (let index = 0; index < CELL_COUNT; index += 1) {
    const digit = board[index]!
    if (digit === 0) continue

    const row = Math.floor(index / 9)
    const column = index % 9
    const box = boxOf(index)
    const bit = digitMask(digit)

    if (
      (rowMasks[row]! & bit) !== 0 ||
      (columnMasks[column]! & bit) !== 0 ||
      (boxMasks[box]! & bit) !== 0
    ) {
      return { state: null, valid: false }
    }

    rowMasks[row] = rowMasks[row]! | bit
    columnMasks[column] = columnMasks[column]! | bit
    boxMasks[box] = boxMasks[box]! | bit
  }

  const candidates = Array(CELL_COUNT).fill(0)

  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (board[index] !== 0) continue

    const row = Math.floor(index / 9)
    const column = index % 9
    const mask = ALL_DIGITS_MASK & ~(rowMasks[row]! | columnMasks[column]! | boxMasks[boxOf(index)]!)

    if (mask === 0) return { state: null, valid: false }
    candidates[index] = mask
  }

  return { state: { board, candidates, contradiction: false }, valid: true }
}

function place(state: CandidateState, index: number, digit: number): boolean {
  const bit = digitMask(digit)
  if (state.board[index] !== 0) {
    if (state.board[index] !== digit) state.contradiction = true
    return false
  }

  if ((state.candidates[index]! & bit) === 0) {
    state.contradiction = true
    return false
  }

  state.board[index] = digit
  state.candidates[index] = 0

  for (const peer of PEERS[index]!) {
    if (state.board[peer] !== 0) continue
    state.candidates[peer] = state.candidates[peer]! & ~bit
    if (state.candidates[peer] === 0) {
      state.contradiction = true
      return false
    }
  }

  return true
}

function eliminate(state: CandidateState, index: number, mask: number): number[] {
  if (state.board[index] !== 0) return []

  const removedMask = state.candidates[index]! & mask
  if (removedMask === 0) return []

  state.candidates[index] = state.candidates[index]! & ~mask
  if (state.candidates[index] === 0) {
    state.contradiction = true
    return []
  }

  return digitsFromMask(removedMask)
}

function placementResult(
  state: CandidateState,
  technique: Technique,
  index: number,
  digit: number,
): StrategyResult | null {
  if (!place(state, index, digit)) return null
  return { technique, placements: [{ index, digit }] }
}

function eliminationResult(
  state: CandidateState,
  technique: Technique,
  index: number,
  mask: number,
): StrategyResult | null {
  const digits = eliminate(state, index, mask)
  if (digits.length === 0) return null
  return { technique, eliminations: [{ index, digits }] }
}

function findNakedSingle(state: CandidateState): StrategyResult | null {
  for (let index = 0; index < CELL_COUNT; index += 1) {
    if (state.board[index] !== 0) continue
    const digit = onlyDigit(state.candidates[index]!)
    if (digit !== null) return placementResult(state, 'naked-single', index, digit)
  }

  return null
}

function findHiddenSingle(state: CandidateState): StrategyResult | null {
  for (const unit of UNITS) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitMask(digit)
      const positions = unit.filter(
        (index) => state.board[index] === 0 && (state.candidates[index]! & bit) !== 0,
      )

      if (positions.length === 1) {
        return placementResult(state, 'hidden-single', positions[0]!, digit)
      }
    }
  }

  return null
}

function findLockedCandidates(state: CandidateState): StrategyResult | null {
  // Pointing: candidates in a box are confined to one row or one column.
  for (let box = 0; box < BOXES.length; box += 1) {
    const unit = BOXES[box]!

    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitMask(digit)
      const positions = unit.filter(
        (index) => state.board[index] === 0 && (state.candidates[index]! & bit) !== 0,
      )
      if (positions.length < 2) continue

      const rows = new Set(positions.map((index) => Math.floor(index / 9)))
      if (rows.size === 1) {
        const row = [...rows][0]!
        for (const index of ROWS[row]!) {
          if (boxOf(index) !== box) {
            const result = eliminationResult(state, 'locked-candidates', index, bit)
            if (result) return result
          }
        }
      }

      const columns = new Set(positions.map((index) => index % 9))
      if (columns.size === 1) {
        const column = [...columns][0]!
        for (const index of COLUMNS[column]!) {
          if (boxOf(index) !== box) {
            const result = eliminationResult(state, 'locked-candidates', index, bit)
            if (result) return result
          }
        }
      }
    }
  }

  // Claiming: candidates in a row/column are confined to one box.
  const lineUnits = [...ROWS, ...COLUMNS]
  for (const unit of lineUnits) {
    for (let digit = 1; digit <= 9; digit += 1) {
      const bit = digitMask(digit)
      const positions = unit.filter(
        (index) => state.board[index] === 0 && (state.candidates[index]! & bit) !== 0,
      )
      if (positions.length < 2) continue

      const boxes = new Set(positions.map((index) => boxOf(index)))
      if (boxes.size !== 1) continue

      const box = [...boxes][0]!
      for (const index of BOXES[box]!) {
        if (!unit.includes(index)) {
          const result = eliminationResult(state, 'locked-candidates', index, bit)
          if (result) return result
        }
      }
    }
  }

  return null
}

function combinations<T>(items: T[], size: number, visit: (picked: T[]) => boolean): boolean {
  const picked: T[] = []

  function visitFrom(start: number): boolean {
    if (picked.length === size) return visit([...picked])

    const remaining = size - picked.length
    for (let index = start; index <= items.length - remaining; index += 1) {
      picked.push(items[index]!)
      if (visitFrom(index + 1)) return true
      picked.pop()
    }

    return false
  }

  return visitFrom(0)
}

function findNakedSubset(state: CandidateState, size: 2 | 3): StrategyResult | null {
  for (const unit of UNITS) {
    const cells = unit.filter((index) => {
      if (state.board[index] !== 0) return false
      const count = bitCount(state.candidates[index]!)
      return count >= 2 && count <= size
    })
    let foundResult: StrategyResult | null = null

    const found = combinations(cells, size, (picked) => {
      const union = picked.reduce((mask, index) => mask | state.candidates[index]!, 0)
      if (bitCount(union) !== size) return false

      for (const index of unit) {
        if (picked.includes(index)) continue
        const result = eliminationResult(state, size === 2 ? 'naked-pair' : 'naked-triple', index, union)
        if (result) {
          foundResult = result
          return true
        }
      }

      return false
    })

    if (found) return foundResult
  }

  return null
}

function findHiddenSubset(state: CandidateState, size: 2 | 3): StrategyResult | null {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  for (const unit of UNITS) {
    const emptyCells = unit.filter((index) => state.board[index] === 0)
    let foundResult: StrategyResult | null = null

    const found = combinations(digits, size, (chosenDigits) => {
      const chosenMask = chosenDigits.reduce((mask, digit) => mask | digitMask(digit), 0)
      const positions = emptyCells.filter((index) => (state.candidates[index]! & chosenMask) !== 0)
      if (positions.length !== size) return false

      if (
        chosenDigits.some(
          (digit) => !positions.some((index) => (state.candidates[index]! & digitMask(digit)) !== 0),
        )
      ) {
        return false
      }

      for (const index of positions) {
        const result = eliminationResult(
          state,
          size === 2 ? 'hidden-pair' : 'hidden-triple',
          index,
          state.candidates[index]! & ~chosenMask,
        )
        if (result) {
          foundResult = result
          return true
        }
      }

      return false
    })

    if (found) return foundResult
  }

  return null
}

function findXWing(state: CandidateState): StrategyResult | null {
  for (let digit = 1; digit <= 9; digit += 1) {
    const bit = digitMask(digit)
    const rowsWithTwo = ROWS.map((unit, row) => ({
      row,
      columns: unit
        .filter((index) => state.board[index] === 0 && (state.candidates[index]! & bit) !== 0)
        .map((index) => index % 9),
    })).filter(({ columns }) => columns.length === 2)

    for (let first = 0; first < rowsWithTwo.length; first += 1) {
      for (let second = first + 1; second < rowsWithTwo.length; second += 1) {
        const left = rowsWithTwo[first]!
        const right = rowsWithTwo[second]!
        if (left.columns[0] !== right.columns[0] || left.columns[1] !== right.columns[1]) continue

        const columns = left.columns
        for (const row of ROWS) {
          const rowNumber = Math.floor(row[0]! / 9)
          if (rowNumber === left.row || rowNumber === right.row) continue

          for (const column of columns) {
            const index = row[column]!
            const result = eliminationResult(state, 'x-wing', index, bit)
            if (result) return result
          }
        }
      }
    }

    const columnsWithTwo = COLUMNS.map((unit, column) => ({
      column,
      rows: unit
        .filter((index) => state.board[index] === 0 && (state.candidates[index]! & bit) !== 0)
        .map((index) => Math.floor(index / 9)),
    })).filter(({ rows }) => rows.length === 2)

    for (let first = 0; first < columnsWithTwo.length; first += 1) {
      for (let second = first + 1; second < columnsWithTwo.length; second += 1) {
        const left = columnsWithTwo[first]!
        const right = columnsWithTwo[second]!
        if (left.rows[0] !== right.rows[0] || left.rows[1] !== right.rows[1]) continue

        const rows = left.rows
        for (const column of COLUMNS) {
          const columnNumber = column[0]! % 9
          if (columnNumber === left.column || columnNumber === right.column) continue

          for (const row of rows) {
            const index = column[row]!
            const result = eliminationResult(state, 'x-wing', index, bit)
            if (result) return result
          }
        }
      }
    }
  }

  return null
}

/**
 * Solve with deterministic human-style techniques only.
 *
 * The generator accepts a puzzle only when this function reaches a complete
 * board. Therefore a generated game never requires a guess/backtracking step
 * for the player to make progress.
 */
export function analyzeSudoku(grid: readonly number[]): SolveAnalysis {
  const initial = createCandidateState(grid)
  if (!initial.state) {
    return {
      solved: false,
      valid: false,
      board: [...grid],
      steps: [],
      usedTechniques: [],
      techniqueCounts: {},
      maxTechnique: null,
      maxRank: 0,
      score: 0,
      rating: 'singles',
    }
  }

  const state = initial.state
  const steps: SolveStep[] = []
  const techniqueCounts: Partial<Record<Technique, number>> = {}
  let maxTechnique: Technique | null = null
  let maxRank = 0
  let score = 0

  const strategies: Array<() => StrategyResult | null> = [
    () => findNakedSingle(state),
    () => findHiddenSingle(state),
    () => findLockedCandidates(state),
    () => findNakedSubset(state, 2),
    () => findHiddenSubset(state, 2),
    () => findNakedSubset(state, 3),
    () => findHiddenSubset(state, 3),
    () => findXWing(state),
  ]

  const maxSteps = 5000
  while (state.board.some((value) => value === 0) && steps.length < maxSteps) {
    let result: StrategyResult | null = null

    for (const strategy of strategies) {
      result = strategy()
      if (state.contradiction) break
      if (result) break
    }

    if (state.contradiction || !result) break

    const step: SolveStep = {
      technique: result.technique,
      placements: result.placements ?? [],
      eliminations: result.eliminations ?? [],
    }
    steps.push(step)

    const rank = TECHNIQUE_RANK[result.technique]
    techniqueCounts[result.technique] = (techniqueCounts[result.technique] ?? 0) + 1
    score += rank * 10 + step.placements.length * 3 + step.eliminations.length

    if (rank > maxRank) {
      maxRank = rank
      maxTechnique = result.technique
    }
  }

  const solved = !state.contradiction && state.board.every((value) => value !== 0)
  const usedTechniques = (Object.keys(techniqueCounts) as Technique[]).sort(
    (left, right) => TECHNIQUE_RANK[left] - TECHNIQUE_RANK[right],
  )

  return {
    solved,
    valid: !state.contradiction,
    board: [...state.board],
    steps,
    usedTechniques,
    techniqueCounts,
    maxTechnique,
    maxRank,
    score,
    rating: ratingForRank(maxRank),
  }
}

interface SearchOptions {
  random?: Random
  limit?: number
}

function searchSolutionsInternal(grid: readonly number[], options: SearchOptions): Grid[] {
  const initial = createCandidateState(grid)
  if (!initial.state) return []

  const state = initial.state
  const solutions: Grid[] = []
  const limit = options.limit ?? 2

  function search(): void {
    if (solutions.length >= limit) return

    let bestIndex = -1
    let bestMask = 0
    let bestCount = 10

    for (let index = 0; index < CELL_COUNT; index += 1) {
      if (state.board[index] !== 0) continue
      const mask = state.candidates[index]!
      const count = bitCount(mask)
      if (count < bestCount) {
        bestIndex = index
        bestMask = mask
        bestCount = count
      }
    }

    if (bestIndex === -1) {
      solutions.push([...state.board])
      return
    }

    const digits = digitsFromMask(bestMask)
    const orderedDigits = options.random ? shuffle(digits, options.random) : digits

    for (const digit of orderedDigits) {
      const snapshotBoard = [...state.board]
      const snapshotCandidates = [...state.candidates]
      const snapshotContradiction = state.contradiction

      if (place(state, bestIndex, digit)) search()

      state.board = snapshotBoard
      state.candidates = snapshotCandidates
      state.contradiction = snapshotContradiction
      if (solutions.length >= limit) return
    }
  }

  search()
  return solutions
}

export function searchSolutions(grid: readonly number[], limit = 2, random?: Random): Grid[] {
  assertGrid(grid)
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Límite no válido')
  const options: SearchOptions = { limit }
  if (random) options.random = random
  return searchSolutionsInternal(grid, options)
}

export function countSolutions(grid: readonly number[], limit = 2): number {
  return searchSolutions(grid, limit).length
}

export function solveSudoku(grid: readonly number[], random?: Random): Grid | null {
  return searchSolutions(grid, 1, random)[0] ?? null
}

export function rateSudoku(grid: readonly number[]): Rating {
  return analyzeSudoku(grid).rating
}

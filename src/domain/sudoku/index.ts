import { parseDateKey, type DateKey } from '../dates'
import { hashSeed, seededRandom, shuffle } from '../utils/random'

export type Difficulty = 'easy' | 'medium' | 'hard'
export type Grid = number[] // 81 cells, 0 = empty
export const GENERATOR_VERSION = 'v1'
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: 'Fácil', medium: 'Media', hard: 'Difícil' }
export const ALL_DIGITS = 0b1111111110
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
export const ROWS = Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => r * 9 + c))
export const COLUMNS = Array.from({ length: 9 }, (_, c) => Array.from({ length: 9 }, (_, r) => r * 9 + c))
export const BOXES = Array.from({ length: 9 }, (_, b) => Array.from({ length: 9 }, (_, i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * 9 + (b % 3) * 3 + i % 3))
export const UNITS = [...ROWS, ...COLUMNS, ...BOXES]
export const boxOf = (i: number) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3)
const PEERS = Array.from({ length: 81 }, (_, i) => [...new Set([...ROWS[Math.floor(i / 9)]!, ...COLUMNS[i % 9]!, ...BOXES[boxOf(i)]!])].filter(j => i !== j))

export interface SudokuPuzzle {
  id: string
  version: typeof GENERATOR_VERSION
  date: DateKey
  difficulty: Difficulty
  givens: Grid
  solution: Grid
  clues: number
  rating: 'singles' | 'pairs-and-locked' | 'advanced'
}

export function puzzleId(date: DateKey, difficulty: Difficulty): string {
  parseDateKey(date)
  if (!DIFFICULTIES.includes(difficulty)) throw new Error('Dificultad no válida')
  return `${GENERATOR_VERSION}:${date}:${difficulty}`
}

function bitCount(value: number): number {
  let count = 0
  while (value) { value &= value - 1; count++ }
  return count
}

function assertGrid(grid: Grid): void {
  if (grid.length !== 81 || grid.some(n => !Number.isInteger(n) || n < 0 || n > 9)) throw new Error('Tablero no válido')
}

export function candidateMask(grid: Grid, index: number): number {
  if (grid[index]) return 0
  let mask = ALL_DIGITS
  for (const peer of PEERS[index]!) mask &= ~(1 << grid[peer]!)
  return mask
}

/** Constraint solver using minimum remaining values; stops as soon as limit is reached. */
function searchSolutions(grid: Grid, limit: number, random?: () => number): { count: number; first: Grid | null } {
  assertGrid(grid)
  const board = [...grid]
  const rows = new Uint16Array(9), columns = new Uint16Array(9), boxes = new Uint16Array(9)
  for (let i = 0; i < 81; i++) {
    if (!board[i]) continue
    const r = Math.floor(i / 9), c = i % 9, b = boxOf(i), bit = 1 << board[i]!
    if ((rows[r]! | columns[c]! | boxes[b]!) & bit) return { count: 0, first: null }
    rows[r]! |= bit; columns[c]! |= bit; boxes[b]! |= bit
  }
  let count = 0
  let first: Grid | null = null
  function visit(): void {
    if (count >= limit) return
    let index = -1, mask = 0, fewest = 10
    for (let i = 0; i < 81; i++) {
      if (board[i]) continue
      const candidates = ALL_DIGITS & ~(rows[Math.floor(i / 9)]! | columns[i % 9]! | boxes[boxOf(i)]!)
      const size = bitCount(candidates)
      if (size === 0) return
      if (size < fewest) { index = i; mask = candidates; fewest = size }
      if (size === 1) break
    }
    if (index === -1) { count++; first ??= [...board]; return }
    const r = Math.floor(index / 9), c = index % 9, b = boxOf(index)
    const options = DIGITS.filter(n => mask & (1 << n))
    for (const value of random ? shuffle(options, random) : options) {
      const bit = 1 << value
      board[index] = value
      rows[r]! |= bit; columns[c]! |= bit; boxes[b]! |= bit
      visit()
      rows[r]! &= ~bit; columns[c]! &= ~bit; boxes[b]! &= ~bit
      board[index] = 0
      if (count >= limit) return
    }
  }
  visit()
  return { count, first }
}

export function countSolutions(grid: Grid, limit = 2): number {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Límite no válido')
  return searchSolutions(grid, limit).count
}

export function solveSudoku(grid: Grid): Grid | null { return searchSolutions(grid, 1).first }

/** A human-style evaluator. “Hard” means more than singles, locked candidates and naked pairs. */
export function rateSudoku(givens: Grid): SudokuPuzzle['rating'] {
  const board = [...givens]
  const candidates = board.map((value, i) => value ? 0 : candidateMask(board, i))
  let usedIntermediate = false
  function place(i: number, value: number): void {
    board[i] = value; candidates[i] = 0
    for (const peer of PEERS[i]!) candidates[peer]! &= ~(1 << value)
  }
  while (board.some(n => n === 0)) {
    let changed = false
    for (let i = 0; i < 81; i++) {
      if (!board[i] && bitCount(candidates[i]!) === 1) {
        place(i, DIGITS.find(n => candidates[i]! & (1 << n))!); changed = true
      }
    }
    if (changed) continue
    for (const unit of UNITS) {
      for (const digit of DIGITS) {
        const positions = unit.filter(i => !board[i] && (candidates[i]! & (1 << digit)))
        if (positions.length === 1) { place(positions[0]!, digit); changed = true }
      }
    }
    if (changed) continue
    // Pointing/claiming: candidates confined to the intersection of two units.
    for (const unit of UNITS) {
      for (const digit of DIGITS) {
        const positions = unit.filter(i => !board[i] && (candidates[i]! & (1 << digit)))
        if (positions.length < 2) continue
        const targets: number[][] = []
        if (positions.every(i => Math.floor(i / 9) === Math.floor(positions[0]! / 9))) targets.push(ROWS[Math.floor(positions[0]! / 9)]!)
        if (positions.every(i => i % 9 === positions[0]! % 9)) targets.push(COLUMNS[positions[0]! % 9]!)
        if (positions.every(i => boxOf(i) === boxOf(positions[0]!))) targets.push(BOXES[boxOf(positions[0]!)]!)
        for (const target of targets) for (const i of target) {
          if (!unit.includes(i) && (candidates[i]! & (1 << digit))) { candidates[i]! &= ~(1 << digit); changed = true }
        }
      }
    }
    if (changed) { usedIntermediate = true; continue }
    for (const unit of UNITS) {
      const pairs = new Map<number, number[]>()
      for (const i of unit) if (!board[i] && bitCount(candidates[i]!) === 2) {
        const pair = pairs.get(candidates[i]!) ?? []; pair.push(i); pairs.set(candidates[i]!, pair)
      }
      for (const [mask, positions] of pairs) {
        if (positions.length !== 2) continue
        for (const i of unit) if (!positions.includes(i) && (candidates[i]! & mask)) { candidates[i]! &= ~mask; changed = true }
      }
    }
    if (changed) { usedIntermediate = true; continue }
    return 'advanced'
  }
  return usedIntermediate ? 'pairs-and-locked' : 'singles'
}

/** Same version + ISO date + difficulty => byte-for-byte identical puzzle on every device. */
export function generateSudoku(date: DateKey, difficulty: Difficulty): SudokuPuzzle {
  const id = puzzleId(date, difficulty)
  const random = seededRandom(hashSeed(`sudoku-diario:${id}`))
  const targetRating = { easy: 'singles', medium: 'pairs-and-locked', hard: 'advanced' } as const
  for (let attempt = 0; attempt < 100; attempt++) {
    const solution = searchSolutions(Array<number>(81).fill(0), 1, random).first!
    const givens = [...solution]
    let clues = 81
    for (const i of shuffle(Array.from({ length: 81 }, (_, j) => j), random)) {
      const previous = givens[i]!
      givens[i] = 0
      if (countSolutions(givens) !== 1) { givens[i] = previous; continue }
      const rating = clues <= 43 ? rateSudoku(givens) : 'singles'
      // Easy never crosses the singles boundary. Medium never crosses the intermediate boundary.
      if (difficulty === 'easy' && rating !== 'singles' || difficulty === 'medium' && rating === 'advanced') {
        givens[i] = previous; continue
      }
      clues--
      if (difficulty === 'easy' && clues <= 39 || difficulty === 'medium' && clues <= 33 && rating === targetRating.medium || difficulty === 'hard' && clues <= 28 && rating === targetRating.hard) {
        return { id, version: GENERATOR_VERSION, date, difficulty, givens, solution, clues, rating }
      }
    }
  }
  throw new Error('No se ha podido generar un tablero de esta dificultad.')
}

export function findConflicts(grid: Grid): Set<number> {
  const conflicts = new Set<number>()
  for (const unit of UNITS) {
    for (const digit of DIGITS) {
      const duplicates = unit.filter(i => grid[i] === digit)
      if (duplicates.length > 1) duplicates.forEach(i => conflicts.add(i))
    }
  }
  return conflicts
}

export function isSolved(values: Grid, puzzle: SudokuPuzzle): boolean {
  return values.length === 81 && values.every((value, i) => value === puzzle.solution[i])
}

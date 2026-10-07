import { parseDateKey as assertDateKey, type DateKey } from '../dates'
import { CELL_COUNT, assertGrid, isSolved as isSolvedGrid } from './board'
import { hashSeed, seededRandom, shuffle, type Random } from '../utils/random'
import {
  analyzeSudoku,
  countSolutions,
  searchSolutions,
} from './solver'
import type { Difficulty, Grid, SolveAnalysis, SudokuPuzzle } from './types'

export const GENERATOR_VERSION = 'v2'
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard']
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Fácil',
  medium: 'Media',
  hard: 'Difícil',
}
export const ALL_DIGITS = 0b1111111110

interface DifficultyProfile {
  /** Do not remove clues below this safety floor. */
  minimumClues: number
  /** Begin looking for a finished candidate once this clue count is reached. */
  targetClues: number
  /** Keep only puzzles whose logical solver never exceeds this technique rank. */
  maximumRank: number
  /** A real level distinction: the puzzle must use at least this rank. */
  minimumRank: number
  maximumAttempts: number
}

export const DIFFICULTY_PROFILES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    minimumClues: 38,
    targetClues: 44,
    minimumRank: 1,
    maximumRank: 2,
    maximumAttempts: 80,
  },
  medium: {
    minimumClues: 30,
    targetClues: 36,
    minimumRank: 3,
    maximumRank: 4,
    maximumAttempts: 120,
  },
  hard: {
    minimumClues: 24,
    targetClues: 31,
    minimumRank: 5,
    maximumRank: 6,
    // Hard puzzles are also backed by a transformed, known-good template
    // below. A bounded retry budget keeps the static page responsive when a
    // random removal path does not reach an advanced technique quickly.
    maximumAttempts: 40,
  },
}

/**
 * A compact advanced template used only as a deterministic hard-level safety
 * net. Row/column bands, digits and transposition are permuted per date, so it
 * still produces a different-looking puzzle without relying on a server.
 * The template was checked with the logical solver and requires rank 5.
 */
const HARD_TEMPLATE_GIVENS: Grid = [
  0, 8, 0, 7, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0, 1,
  0, 0, 3, 0, 0, 6, 8, 0, 0,
  0, 0, 0, 0, 5, 0, 7, 1, 4,
  4, 0, 0, 8, 0, 0, 2, 0, 3,
  0, 9, 2, 0, 4, 0, 0, 0, 5,
  0, 0, 0, 0, 0, 0, 3, 0, 0,
  0, 0, 0, 2, 0, 5, 9, 0, 0,
  2, 0, 6, 3, 7, 0, 0, 0, 0,
]

const HARD_TEMPLATE_SOLUTION: Grid = [
  5, 8, 9, 7, 3, 1, 4, 2, 6,
  6, 2, 7, 4, 9, 8, 5, 3, 1,
  1, 4, 3, 5, 2, 6, 8, 7, 9,
  3, 6, 8, 9, 5, 2, 7, 1, 4,
  4, 1, 5, 8, 6, 7, 2, 9, 3,
  7, 9, 2, 1, 4, 3, 6, 8, 5,
  9, 7, 1, 6, 8, 4, 3, 5, 2,
  8, 3, 4, 2, 1, 5, 9, 6, 7,
  2, 5, 6, 3, 7, 9, 1, 4, 8,
]

interface CandidatePuzzle {
  givens: Grid
  solution: Grid
  clues: number
  analysis: SolveAnalysis
}

function shuffledBandOrder(random: Random): number[] {
  const bands = shuffle([0, 1, 2], random)
  const rows: number[] = []

  for (const band of bands) {
    for (const row of shuffle([0, 1, 2], random)) rows.push(band * 3 + row)
  }

  return rows
}

/** Apply Sudoku-preserving symmetries to a template. */
function transformTemplate(grid: Grid, random: Random): Grid {
  const rowOrder = shuffledBandOrder(random)
  const columnOrder = shuffledBandOrder(random)
  const digitOrder = [0, ...shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9], random)]
  const transformed = Array<number>(CELL_COUNT).fill(0)

  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const sourceIndex = rowOrder[row]! * 9 + columnOrder[column]!
      const digit = grid[sourceIndex]!
      transformed[row * 9 + column] = digit === 0 ? 0 : digitOrder[digit]!
    }
  }

  if (random() >= 0.5) return transformed

  const transposed = Array<number>(CELL_COUNT).fill(0)
  for (let row = 0; row < 9; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      transposed[row * 9 + column] = transformed[column * 9 + row]!
    }
  }

  return transposed
}

function hardTemplateCandidate(date: DateKey): CandidatePuzzle | null {
  const random = seededRandom(hashSeed(`${GENERATOR_VERSION}:${date}:hard:template`))
  const givens = transformTemplate(HARD_TEMPLATE_GIVENS, random)
  const solution = transformTemplate(HARD_TEMPLATE_SOLUTION, seededRandom(hashSeed(`${GENERATOR_VERSION}:${date}:hard:template`)))
  const analysis = analyzeSudoku(givens)

  if (!analysis.solved || countSolutions(givens, 2) !== 1) return null

  return {
    givens,
    solution,
    clues: givens.filter((value) => value !== 0).length,
    analysis,
  }
}

function profileFor(difficulty: Difficulty): DifficultyProfile {
  return DIFFICULTY_PROFILES[difficulty]
}

function isBetterFallback(
  candidate: CandidatePuzzle,
  current: CandidatePuzzle | null,
  difficulty: Difficulty,
): boolean {
  if (!current) return true

  const profile = profileFor(difficulty)
  const candidateRankDistance = Math.abs(candidate.analysis.maxRank - profile.minimumRank)
  const currentRankDistance = Math.abs(current.analysis.maxRank - profile.minimumRank)
  if (candidateRankDistance !== currentRankDistance) {
    return candidateRankDistance < currentRankDistance
  }

  const candidateClueDistance = Math.abs(candidate.clues - profile.targetClues)
  const currentClueDistance = Math.abs(current.clues - profile.targetClues)
  if (candidateClueDistance !== currentClueDistance) {
    return candidateClueDistance < currentClueDistance
  }

  return candidate.analysis.score > current.analysis.score
}

function matchesProfile(candidate: CandidatePuzzle, profile: DifficultyProfile): boolean {
  return (
    candidate.analysis.solved &&
    candidate.clues >= profile.minimumClues &&
    candidate.clues <= profile.targetClues &&
    candidate.analysis.maxRank >= profile.minimumRank &&
    candidate.analysis.maxRank <= profile.maximumRank
  )
}

function buildCandidate(solution: Grid, random: Random, profile: DifficultyProfile): CandidatePuzzle | null {
  const givens = [...solution]
  let clues = CELL_COUNT
  let latest: CandidatePuzzle | null = null
  const removalOrder = shuffle(Array.from({ length: CELL_COUNT }, (_, index) => index), random)

  for (const index of removalOrder) {
    if (clues - 1 < profile.minimumClues) continue

    const previous = givens[index]!
    givens[index] = 0

    // A logical solve is not enough: the final board must still have one answer.
    if (countSolutions(givens, 2) !== 1) {
      givens[index] = previous
      continue
    }

    const analysis = analyzeSudoku(givens)
    if (!analysis.solved || analysis.maxRank > profile.maximumRank) {
      givens[index] = previous
      continue
    }

    clues -= 1
    latest = { givens: [...givens], solution: [...solution], clues, analysis }

    if (matchesProfile(latest, profile)) return latest
  }

  return latest
}

function generateAttempt(date: DateKey, difficulty: Difficulty, attempt: number): CandidatePuzzle | null {
  const id = puzzleId(date, difficulty)
  const random = seededRandom(
    hashSeed(`${GENERATOR_VERSION}:${id}:attempt:${attempt}`),
  )
  const solution = searchSolutions(Array(CELL_COUNT).fill(0), 1, random)[0]
  if (!solution) return null

  return buildCandidate(solution, random, profileFor(difficulty))
}

/** Stable identifier used by persistence and by the deterministic seed. */
export function puzzleId(date: string, difficulty: Difficulty): string {
  assertDateKey(date)
  if (!DIFFICULTIES.includes(difficulty)) throw new Error('Invalid difficulty.')
  return `${GENERATOR_VERSION}:${date}:${difficulty}`
}

/**
 * Generate one deterministic puzzle.
 *
 * Every candidate has exactly one mathematical solution and is completely
 * solved by the bundled logical techniques. Profiles use the strongest
 * technique encountered, rather than just the number of clues. If the retry
 * budget is exhausted, the final fallback may fall short of the requested
 * profile; rating and analysis still describe its actual logical difficulty.
 */
export function generateSudoku(date: string, difficulty: Difficulty = 'hard'): SudokuPuzzle {
  puzzleId(date, difficulty)
  const profile = profileFor(difficulty)
  let best: CandidatePuzzle | null = null

  for (let attempt = 0; attempt < profile.maximumAttempts; attempt += 1) {
    const candidate = generateAttempt(date, difficulty, attempt)
    if (!candidate) continue

    if (isBetterFallback(candidate, best, difficulty)) best = candidate
    if (matchesProfile(candidate, profile)) return toPuzzle(date, difficulty, candidate)
  }

  if (difficulty === 'hard') {
    const template = hardTemplateCandidate(date)
    if (template && matchesProfile(template, profile)) return toPuzzle(date, difficulty, template)
  }

  // A deterministic fallback is preferable to a broken daily page. It still
  // has a unique solution and is logically solvable; only the requested rank
  // could not be found for this particular seed within the retry budget.
  if (best) return toPuzzle(date, difficulty, best)

  throw new Error(
    `Could not generate a valid Sudoku for ${date} (${difficulty}). ` +
      'Try increasing the attempt budget in DIFFICULTY_PROFILES.',
  )
}

/**
 * Compatibility helper for stores that validate a saved game against the
 * generated solution. With no puzzle argument it validates a standalone grid.
 */
export function isSolved(values: readonly number[], puzzle?: Pick<SudokuPuzzle, 'solution'>): boolean {
  if (puzzle) {
    return isSolvedGrid(values) && values.every((value, index) => value === puzzle.solution[index])
  }

  return isSolvedGrid(values)
}

function toPuzzle(date: DateKey, difficulty: Difficulty, candidate: CandidatePuzzle): SudokuPuzzle {
  const rating = candidate.analysis.rating
  if (rating === null) throw new Error('No se puede clasificar un sudoku sin resolución lógica completa.')
  return {
    id: puzzleId(date, difficulty),
    version: GENERATOR_VERSION,
    date,
    difficulty,
    givens: candidate.givens,
    solution: candidate.solution,
    clues: candidate.clues,
    rating,
    analysis: candidate.analysis,
  }
}

export { assertGrid }
export { analyzeSudoku, countSolutions, rateSudoku, searchSolutions, solveSudoku } from './solver'
export {
  ALL_DIGITS_MASK,
  BOXES,
  COLUMNS,
  PEERS,
  ROWS,
  UNITS,
  bitCount,
  boxOf,
  candidateMask,
  digitMask,
  digitsFromMask,
  findConflicts,
  isValidGrid,
  onlyDigit,
} from './board'
export { hashSeed, seededRandom, shuffle } from '../utils/random'
export type { Difficulty, Grid, Rating, SolveAnalysis, SudokuPuzzle, Technique } from './types'

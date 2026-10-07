/** A Sudoku board is a flat array of 81 cells. Zero means "empty". */
export type Grid = number[]

export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * The public rating names are kept intentionally small so they can be shown
 * in an existing UI without knowing every individual solving technique.
 */
export type Rating = 'singles' | 'pairs-and-locked' | 'advanced'

/** Techniques implemented by the logical solver, ordered by difficulty. */
export type Technique =
  | 'naked-single'
  | 'hidden-single'
  | 'locked-candidates'
  | 'naked-pair'
  | 'hidden-pair'
  | 'naked-triple'
  | 'hidden-triple'
  | 'x-wing'

export interface CellPlacement {
  index: number
  digit: number
}

export interface CandidateElimination {
  index: number
  digits: number[]
}

export interface SolveStep {
  technique: Technique
  placements: CellPlacement[]
  eliminations: CandidateElimination[]
}

export interface SolveAnalysis {
  /** True only when the logical techniques solved every empty cell. */
  solved: boolean
  /** False means the givens are contradictory or a candidate became empty. */
  valid: boolean
  board: Grid
  steps: SolveStep[]
  usedTechniques: Technique[]
  techniqueCounts: Partial<Record<Technique, number>>
  maxTechnique: Technique | null
  maxRank: number
  score: number
  rating: Rating
}

export interface SudokuPuzzle {
  id: string
  version: 'v2'
  date: string
  difficulty: Difficulty
  givens: Grid
  solution: Grid
  clues: number
  /** Compatibility-friendly short rating. See `analysis` for the detail. */
  rating: Rating
  analysis: SolveAnalysis
}

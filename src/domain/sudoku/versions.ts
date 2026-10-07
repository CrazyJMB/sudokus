import { generateSudoku, GENERATOR_VERSION } from './generator'
import { generateSudoku as generateLegacySudoku } from './legacy-v1'
import type { SudokuPuzzle as LegacyPuzzle } from './legacy-v1'
import type { Difficulty, SudokuPuzzle as CurrentPuzzle } from './types'

export type GeneratorVersion = 'v1' | typeof GENERATOR_VERSION
export type SudokuPuzzle = LegacyPuzzle | CurrentPuzzle

export function isGeneratorVersion(value: unknown): value is GeneratorVersion {
  return value === 'v1' || value === GENERATOR_VERSION
}

export function puzzleVersion(id: string): GeneratorVersion {
  const version = id.split(':')[0]
  if (!isGeneratorVersion(version)) throw new Error('Versión de sudoku no compatible.')
  return version
}

/** Old saves must always be reconstructed with their original algorithm. */
export function generatePuzzleForVersion(date: string, difficulty: Difficulty, version: GeneratorVersion = GENERATOR_VERSION): SudokuPuzzle {
  if (!isGeneratorVersion(version)) throw new Error('Versión de sudoku no compatible.')
  return version === 'v1' ? generateLegacySudoku(date, difficulty) : generateSudoku(date, difficulty)
}

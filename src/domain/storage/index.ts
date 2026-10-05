import { isDateKey } from '../dates'
import { GENERATOR_VERSION, DIFFICULTIES, ALL_DIGITS, generateSudoku, isSolved, puzzleId, type Difficulty } from '../sudoku'
import type { SavedGame } from '../history'

export const STORAGE_SCHEMA = 2
export const BACKUP_FORMAT = 'sudoku-diario-progreso'
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export interface Preferences {
  defaultDifficulty: Difficulty
  highlightMatching: boolean
  highlightRelated: boolean
  showConflicts: boolean
  showRemainingCounts: boolean
  showProgress: boolean
  autoRemoveNotes: boolean
}
export type AidPreference = Exclude<keyof Preferences, 'defaultDifficulty'>
export const DEFAULT_PREFERENCES: Readonly<Preferences> = Object.freeze({
  defaultDifficulty: 'hard', highlightMatching: false, highlightRelated: false,
  showConflicts: false, showRemainingCounts: false, showProgress: false, autoRemoveNotes: false,
})
export const AID_OPTIONS: readonly { key: AidPreference; label: string; description: string }[] = [
  { key: 'highlightMatching', label: 'Resaltar números iguales', description: 'Marca las casillas con el mismo número que la seleccionada.' },
  { key: 'highlightRelated', label: 'Resaltar fila, columna y bloque', description: 'Marca la zona relacionada con la casilla seleccionada.' },
  { key: 'showConflicts', label: 'Avisar de números repetidos', description: 'Muestra en rojo repeticiones en una fila, columna o bloque.' },
  { key: 'showRemainingCounts', label: 'Mostrar números restantes', description: 'Indica cuántas veces queda por colocar cada número.' },
  { key: 'showProgress', label: 'Mostrar porcentaje rellenado', description: 'Añade una barra con el avance del tablero.' },
  { key: 'autoRemoveNotes', label: 'Borrar notas automáticamente', description: 'Al escribir un número, retira las notas que entran en conflicto con él.' },
]

export interface DurableState {
  schema: typeof STORAGE_SCHEMA
  generator: typeof GENERATOR_VERSION
  preferences: Preferences
  games: Record<string, SavedGame>
}
export interface ProgressBackup {
  format: typeof BACKUP_FORMAT
  version: 1
  exportedAt: string
  data: DurableState
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function timestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value))
}
function numberArray(value: unknown, notes = false): value is number[] {
  return Array.isArray(value) && value.length === 81 && value.every(n => Number.isInteger(n) && n >= 0 && (notes ? n <= ALL_DIGITS && (n & ~ALL_DIGITS) === 0 : n <= 9))
}

function readPreferences(value: unknown, strict: boolean): Preferences {
  const result = { ...DEFAULT_PREFERENCES }
  if (!record(value)) {
    if (strict) throw new Error('El archivo no contiene preferencias válidas.')
    return result
  }
  if (DIFFICULTIES.includes(value.defaultDifficulty as Difficulty)) result.defaultDifficulty = value.defaultDifficulty as Difficulty
  else if (strict) throw new Error('La dificultad predeterminada no es válida.')
  for (const { key } of AID_OPTIONS) {
    if (typeof value[key] === 'boolean') result[key] = value[key] as boolean
    else if (strict && value[key] !== undefined) throw new Error('El archivo contiene una preferencia no válida.')
  }
  return result
}

/** Read old local saves without losing games. Imports reject any malformed record. */
export function readDurableState(value: unknown, strict = false): DurableState {
  if (!record(value) || ![1, STORAGE_SCHEMA].includes(value.schema as number) || value.generator !== GENERATOR_VERSION || !record(value.games)) {
    throw new Error('El guardado tiene un formato o una versión incompatible.')
  }
  const games: Record<string, SavedGame> = {}
  for (const [id, item] of Object.entries(value.games)) {
    if (!record(item) || !isDateKey(item.date) || !DIFFICULTIES.includes(item.difficulty as Difficulty) || !numberArray(item.values) || !numberArray(item.notes, true) || !timestamp(item.startedAt) || id !== puzzleId(item.date, item.difficulty as Difficulty)) {
      if (strict) throw new Error('El archivo contiene una partida no válida. No se ha importado nada.')
      continue
    }
    const completed = timestamp(item.completedAt) && isDateKey(item.completedOn) && item.completedOn >= item.date && !item.values.includes(0)
    if (strict && !completed && (item.completedAt !== null || item.completedOn !== null)) throw new Error('Una partida contiene una finalización no válida.')
    games[id] = {
      date: item.date, difficulty: item.difficulty as Difficulty,
      values: [...item.values], notes: [...item.notes], startedAt: item.startedAt,
      completedAt: completed ? item.completedAt as string : null,
      completedOn: completed ? item.completedOn as string : null,
    }
  }
  // Version 1 had a last-played difficulty, not an explicit default setting.
  const preferences = value.schema === 1 ? { ...DEFAULT_PREFERENCES } : readPreferences(value.preferences, strict)
  return { schema: STORAGE_SCHEMA, generator: GENERATOR_VERSION, preferences, games }
}

export function serializeBackup(state: DurableState, now = new Date()): string {
  const backup: ProgressBackup = { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), data: state }
  return JSON.stringify(backup, null, 2)
}

export function parseBackup(text: string): ProgressBackup {
  if (text.length > MAX_BACKUP_BYTES) throw new Error('El archivo supera el límite de 10 MB.')
  let value: unknown
  try { value = JSON.parse(text) } catch { throw new Error('No se pudo leer el archivo. Elige una exportación JSON de Sudoku diario.') }
  if (!record(value) || value.format !== BACKUP_FORMAT || value.version !== 1 || !timestamp(value.exportedAt)) {
    throw new Error('Este archivo no es una exportación compatible de Sudoku diario.')
  }
  return { format: BACKUP_FORMAT, version: 1, exportedAt: value.exportedAt, data: readDurableState(value.data, true) }
}

/** Also validate the actual daily givens and completed solutions, before changing any data. */
export function validateImportedGames(games: Record<string, SavedGame>, onProgress?: (done: number, total: number) => void): void {
  const entries = Object.values(games)
  for (const [index, game] of entries.entries()) {
    const puzzle = generateSudoku(game.date, game.difficulty)
    if (!puzzle.givens.every((value, i) => value === 0 || game.values[i] === value) || game.completedAt && !isSolved(game.values, puzzle)) {
      throw new Error(`La partida del ${game.date} contiene números iniciales o una solución incorrectos. No se ha importado nada.`)
    }
    onProgress?.(index + 1, entries.length)
  }
}

export function mergeGames(local: Record<string, SavedGame>, incoming: Record<string, SavedGame>) {
  const games = structuredClone(local)
  let added = 0, updated = 0, kept = 0
  for (const [id, imported] of Object.entries(incoming)) {
    const current = games[id]
    if (!current) { games[id] = structuredClone(imported); added++; continue }
    // Never lose a completed game or a day that was genuinely credited on either device.
    if (current.completedAt && (!imported.completedAt || current.completedOn === current.date || imported.completedOn !== imported.date)) {
      kept++; continue
    }
    games[id] = structuredClone(imported); updated++
  }
  return { games, added, updated, kept }
}

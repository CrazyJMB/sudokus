import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { todayKey, isDateKey, type DateKey } from '@/domain/dates'
import { GENERATOR_VERSION, DIFFICULTIES, candidateMask, findConflicts, isSolved, type Difficulty, type GeneratorVersion, type SudokuPuzzle } from '@/domain/sudoku'
import { streaks, type SavedGame } from '@/domain/history'
import { generatePuzzleAsync } from '@/infrastructure/async/generate-async'
import { DEFAULT_PREFERENCES, STORAGE_SCHEMA, readDurableState, mergeGames, type DurableState, type Preferences, type ProgressBackup } from '@/domain/storage'

export const STORAGE_KEY = `sudoku-diario:${GENERATOR_VERSION}:state`
export const LEGACY_STORAGE_KEY = 'sudoku-diario:v1:state'

export const useSudokuStore = defineStore('sudoku', () => {
  const games = ref<Record<string, SavedGame>>({})
  const preferences = ref<Preferences>({ ...DEFAULT_PREFERENCES })
  const preferredDifficulty = computed(() => preferences.value.defaultDifficulty)
  const today = ref(todayKey())
  const selectedDate = ref<DateKey>(today.value)
  const difficulty = ref<Difficulty>('hard')
  const puzzle = ref<SudokuPuzzle | null>(null)
  const loading = ref(false)
  const error = ref('')
  const storageError = ref('')
  const selectedIndex = ref<number | null>(null)
  const notesMode = ref(false)
  const undoStack = ref<Array<{ values: number[]; notes: number[] }>>([])
  let generation: AbortController | null = null
  let request = 0

  const currentGame = computed(() => puzzle.value ? games.value[puzzle.value.id] ?? null : null)
  const conflicts = computed(() => preferences.value.showConflicts && currentGame.value ? findConflicts(currentGame.value.values) : new Set<number>())
  const isHistorical = computed(() => selectedDate.value < today.value)
  const stats = computed(() => ({
    ...streaks(Object.values(games.value), today.value),
    total: Object.values(games.value).filter(game => game.completedAt).length,
    days: new Set(Object.values(games.value).filter(game => game.completedAt).map(game => game.date)).size,
  }))
  const progress = computed(() => {
    if (!puzzle.value || !currentGame.value) return 0
    const open = puzzle.value.givens.filter(n => !n).length
    const filled = currentGame.value.values.filter((n, i) => n && !puzzle.value!.givens[i]).length
    return open ? Math.round(filled / open * 100) : 100
  })

  function refreshToday(now = new Date()): void { today.value = todayKey(now) }

  function hydrate(storage?: Pick<Storage, 'getItem'>): void {
    try {
      const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
      const raw = target?.getItem(STORAGE_KEY) ?? target?.getItem(LEGACY_STORAGE_KEY)
      if (!raw) return
      const restored = readDurableState(JSON.parse(raw))
      games.value = restored.games
      preferences.value = restored.preferences
    } catch {
      storageError.value = 'No se pudo leer el guardado. Puedes jugar, pero el historial no se guardará en esta sesión.'
    }
  }

  function durableState(): DurableState {
    return { schema: STORAGE_SCHEMA, generator: GENERATOR_VERSION, preferences: preferences.value, games: games.value }
  }

  async function openGame(date: DateKey, level: Difficulty, version?: GeneratorVersion): Promise<void> {
    refreshToday()
    if (!isDateKey(date) || date > today.value || !DIFFICULTIES.includes(level)) { error.value = 'Elige una fecha de hoy o anterior.'; return }
    generation?.abort()
    generation = new AbortController()
    const currentRequest = ++request
    selectedDate.value = date; difficulty.value = level
    selectedIndex.value = null; notesMode.value = false; undoStack.value = []
    loading.value = true; error.value = ''; puzzle.value = null
    try {
      const selectedVersion = version ?? (games.value[`${GENERATOR_VERSION}:${date}:${level}`] ? GENERATOR_VERSION : games.value[`v1:${date}:${level}`] ? 'v1' : GENERATOR_VERSION)
      const generated = await generatePuzzleAsync(date, level, generation.signal, selectedVersion)
      if (currentRequest !== request) return
      const previous = games.value[generated.id]
      if (!previous) {
        games.value[generated.id] = { version: generated.version, date, difficulty: level, values: [...generated.givens], notes: Array<number>(81).fill(0), startedAt: new Date().toISOString(), completedAt: null, completedOn: null }
      } else {
        // Protect immutable clues and normalize invalid completion records on reopening.
        previous.values = previous.values.map((value, i) => generated.givens[i] || value)
        previous.notes = previous.notes.map((mask, i) => previous.values[i] ? 0 : mask)
        if (previous.completedAt && !isSolved(previous.values, generated)) { previous.completedAt = null; previous.completedOn = null }
      }
      puzzle.value = generated
      selectedIndex.value = generated.givens.findIndex(n => n === 0)
      finishIfSolved()
    } catch (cause) {
      if (currentRequest === request && !(cause instanceof DOMException && cause.name === 'AbortError')) {
        error.value = cause instanceof Error ? cause.message : 'No se pudo abrir el sudoku.'
      }
    } finally { if (currentRequest === request) loading.value = false }
  }

  function remember(): void {
    if (!currentGame.value) return
    undoStack.value.push({ values: [...currentGame.value.values], notes: [...currentGame.value.notes] })
    if (undoStack.value.length > 100) undoStack.value.shift()
  }

  function finishIfSolved(now = new Date()): void {
    refreshToday(now)
    const game = currentGame.value
    if (!game || !puzzle.value || game.completedAt || game.date > today.value || !isSolved(game.values, puzzle.value)) return
    game.completedAt = now.toISOString()
    game.completedOn = today.value
    game.notes.fill(0)
    undoStack.value = []
  }

  function enterDigit(value: number): void {
    refreshToday()
    const game = currentGame.value, index = selectedIndex.value
    if (!game || !puzzle.value || game.completedAt || index === null || index < 0 || index > 80 || puzzle.value.givens[index] || game.date > today.value || !Number.isInteger(value) || value < 1 || value > 9) return
    if (notesMode.value) {
      if (game.values[index]) return
      remember(); game.notes[index]! ^= 1 << value
    } else {
      if (game.values[index] === value) return
      remember(); game.values[index] = value; game.notes[index] = 0
      if (preferences.value.autoRemoveNotes) {
        game.notes = game.notes.map((mask, i) => game.values[i] ? 0 : mask & candidateMask(game.values, i))
      }
      finishIfSolved()
    }
  }

  function erase(): void {
    const game = currentGame.value, index = selectedIndex.value
    if (!game || !puzzle.value || game.completedAt || index === null || puzzle.value.givens[index] || (!game.values[index] && !game.notes[index])) return
    remember(); game.values[index] = 0; game.notes[index] = 0
  }

  function undo(): void {
    const previous = undoStack.value.pop()
    if (!currentGame.value || currentGame.value.completedAt || !previous) return
    currentGame.value.values = previous.values; currentGame.value.notes = previous.notes
  }

  return { games, preferences, preferredDifficulty, today, selectedDate, difficulty, puzzle, loading, error, storageError, selectedIndex, notesMode, undoStack, currentGame, conflicts, isHistorical, stats, progress, hydrate, durableState, refreshToday, openGame, enterDigit, erase, undo, finishIfSolved }
})

/** Explicit Pinia persistence: serialize durable fields only; failures leave play usable. */
export function persistSudoku(store: ReturnType<typeof useSudokuStore>, storage?: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>>): () => void {
  let lastSaved = ''
  return store.$subscribe(() => {
    if (store.storageError) return
    try {
      const serialized = JSON.stringify(store.durableState())
      if (serialized === lastSaved) return
      const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
      if (target?.getItem?.(STORAGE_KEY) !== serialized) target?.setItem(STORAGE_KEY, serialized)
      lastSaved = serialized
    } catch {
      store.storageError = 'Tu navegador no permite guardar más datos. El progreso de esta sesión puede perderse al cerrar.'
    }
  }, { detached: true, flush: 'sync' })
}

/** The file has already been validated. Write once before touching the running game or history. */
export function applyBackup(store: ReturnType<typeof useSudokuStore>, backup: ProgressBackup, storage?: Pick<Storage, 'setItem'>) {
  const local = JSON.parse(JSON.stringify(store.games)) as Record<string, SavedGame>
  const merged = mergeGames(local, backup.data.games)
  const next = { schema: STORAGE_SCHEMA, generator: GENERATOR_VERSION, preferences: { ...backup.data.preferences }, games: merged.games }
  const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  if (!target) throw new Error('Este navegador no permite guardar el progreso importado.')
  try { target.setItem(STORAGE_KEY, JSON.stringify(next)) }
  catch { throw new Error('No hay espacio o no se permite guardar en este navegador. No se ha importado nada.') }
  store.$patch(() => {
    store.games = next.games
    store.preferences = next.preferences
    store.undoStack = []
    store.storageError = ''
  })
  return { added: merged.added, updated: merged.updated, kept: merged.kept }
}

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { applyBackup, persistSudoku, STORAGE_KEY, useSudokuStore } from '../src/stores/sudoku'
import { DEFAULT_PREFERENCES, mergeGames, parseBackup, readDurableState, serializeBackup } from '../src/lib/persistence'
import { prepareBackup } from '../src/lib/backup-async'
import type { SavedGame } from '../src/lib/history'

const data = new Map<string, string>()
const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value) } }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 2, 10)); setActivePinia(createPinia()); data.clear() })
afterEach(() => vi.useRealTimers())

describe('experiencia sin ayudas y guardados anteriores', () => {
  it('empieza en difícil con todas las ayudas desactivadas', () => {
    const store = useSudokuStore()
    expect(store.preferredDifficulty).toBe('hard')
    expect(store.difficulty).toBe('hard')
    expect(store.preferences).toEqual(DEFAULT_PREFERENCES)
  })

  it('migra las partidas antiguas sin cambiar el generador ni perder el historial', async () => {
    const original = useSudokuStore(); await original.openGame('2026-10-01', 'easy')
    original.currentGame!.values = [...original.puzzle!.solution]; original.finishIfSolved()
    const games = JSON.parse(JSON.stringify(original.games))
    storage.setItem(STORAGE_KEY, JSON.stringify({ schema: 1, generator: 'v1', preferredDifficulty: 'easy', games }))
    const restored = useSudokuStore(createPinia()); restored.hydrate(storage)
    expect(restored.games).toEqual(games)
    expect(restored.preferences).toEqual(DEFAULT_PREFERENCES)
    expect(restored.stats.total).toBe(1)
  })

  it('conserva las notas manuales al escribir y recargar; las borra solo al activar la opción', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'hard')
    const empty = store.puzzle!.givens.map((n, i) => n ? -1 : i).filter(i => i >= 0)
    const first = empty.find(i => empty.some(j => i !== j && Math.floor(i / 9) === Math.floor(j / 9)))!
    const second = empty.find(i => i !== first && Math.floor(i / 9) === Math.floor(first / 9))!
    store.selectedIndex = second; store.notesMode = true; store.enterDigit(5)
    store.selectedIndex = first; store.notesMode = false; store.enterDigit(5)
    expect(store.currentGame!.notes[second]).toBe(1 << 5)
    await store.openGame('2026-10-02', 'hard')
    expect(store.currentGame!.notes[second]).toBe(1 << 5)
    store.selectedIndex = first; store.erase(); store.preferences.autoRemoveNotes = true; store.enterDigit(5)
    expect(store.currentGame!.notes[second]).toBe(0)
  })
})

describe('exportar e importar entre dispositivos', () => {
  it('traslada partidas, notas, preferencias y racha, y los recupera tras recargar', async () => {
    const source = useSudokuStore()
    for (const day of [30, 1]) {
      const month = day === 30 ? 8 : 9
      vi.setSystemTime(new Date(2026, month, day, 10))
      await source.openGame(day === 30 ? '2026-09-30' : '2026-10-01', 'hard')
      source.currentGame!.values = [...source.puzzle!.solution]; source.finishIfSolved()
    }
    vi.setSystemTime(new Date(2026, 9, 2, 10))
    await source.openGame('2026-10-02', 'hard')
    const empty = source.puzzle!.givens.map((n, i) => n ? -1 : i).filter(i => i >= 0)
    source.selectedIndex = empty[0]!; source.enterDigit(6)
    source.selectedIndex = empty[1]!; source.notesMode = true; source.enterDigit(7)
    source.preferences.highlightMatching = true
    source.preferences.defaultDifficulty = 'medium'
    const exported = serializeBackup(source.durableState())
    const backup = await prepareBackup(exported)
    const target = useSudokuStore(createPinia())
    await target.openGame('2026-09-29', 'hard')
    target.currentGame!.values = [...target.puzzle!.solution]; target.finishIfSolved()
    const stop = persistSudoku(target, storage)
    applyBackup(target, backup, storage)
    expect(target.stats).toEqual({ current: 2, best: 2, total: 3, days: 3 })
    expect(target.preferences).toEqual(source.preferences)
    const restored = useSudokuStore(createPinia()); restored.hydrate(storage)
    expect(restored.stats.current).toBe(2)
    await restored.openGame('2026-10-02', 'hard')
    expect(restored.currentGame!.values).toEqual(source.currentGame!.values)
    expect(restored.currentGame!.notes).toEqual(source.currentGame!.notes)
    stop()
  })

  it('no sobrescribe partidas completadas y conserva el crédito original de cualquiera de los dispositivos', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-01', 'hard')
    const id = store.puzzle!.id
    const partial = JSON.parse(JSON.stringify(store.currentGame)) as SavedGame
    const complete = { ...partial, values: [...store.puzzle!.solution], completedAt: '2026-10-01T10:00:00.000Z', completedOn: '2026-10-01' }
    const historical = { ...complete, completedAt: '2026-10-02T10:00:00.000Z', completedOn: '2026-10-02' }
    expect(mergeGames({ [id]: complete }, { [id]: partial }).games[id]).toEqual(complete)
    expect(mergeGames({ [id]: historical }, { [id]: complete }).games[id]).toEqual(complete)
    expect(mergeGames({ [id]: complete }, { [id]: historical }).games[id]).toEqual(complete)
  })

  it('rechaza archivos corruptos, incompatibles o con una falsa victoria sin tocar el historial', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'hard')
    const before = serializeBackup(store.durableState())
    expect(() => parseBackup('{')).toThrow()
    const invalid = JSON.parse(before)
    invalid.data.generator = 'v99'
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow()
    invalid.data.generator = 'v1'
    const game = invalid.data.games[store.puzzle!.id]
    game.values = Array<number>(81).fill(1)
    game.completedAt = '2026-10-02T10:00:00.000Z'; game.completedOn = '2026-10-02'
    await expect(prepareBackup(JSON.stringify(invalid))).rejects.toThrow()
    expect(serializeBackup(store.durableState())).toBe(before)
  })

  it('deja el progreso intacto si el navegador rechaza guardar la importación', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'hard')
    const backup = await prepareBackup(serializeBackup(store.durableState()))
    backup.data.preferences.showConflicts = true
    const before = serializeBackup(store.durableState())
    expect(() => applyBackup(store, backup, { setItem() { throw new Error('QuotaExceededError') } })).toThrow('No se ha importado nada')
    expect(serializeBackup(store.durableState())).toBe(before)
  })

  it('rechaza IDs, números, notas y preferencias inválidos antes de generar tableros', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'hard')
    const valid = JSON.parse(serializeBackup(store.durableState()))
    for (const alter of [
      (copy: typeof valid) => { copy.data.games[store.puzzle!.id].values[0] = 12 },
      (copy: typeof valid) => { copy.data.games[store.puzzle!.id].notes[0] = 1023 },
      (copy: typeof valid) => { copy.data.preferences.showConflicts = 'true' },
      (copy: typeof valid) => { copy.data.games['invalid'] = copy.data.games[store.puzzle!.id] },
    ]) {
      const copy = structuredClone(valid); alter(copy)
      expect(() => parseBackup(JSON.stringify(copy))).toThrow()
    }
    expect(() => readDurableState({ schema: 99 })).toThrow()
  })
})

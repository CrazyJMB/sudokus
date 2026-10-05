import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { persistSudoku, STORAGE_KEY, useSudokuStore } from '../src/stores/sudoku'

const values = new Map<string, string>()
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 2, 10)); setActivePinia(createPinia()); values.clear() })
afterEach(() => vi.useRealTimers())

describe('partidas y persistencia Pinia', () => {
  it('guarda números, notas y preferencias y los recupera tras recargar', async () => {
    const store = useSudokuStore()
    const stop = persistSudoku(store, storage)
    store.preferences.defaultDifficulty = 'medium'
    store.preferences.highlightMatching = true
    await store.openGame('2026-10-02', 'medium')
    const empty = store.puzzle!.givens.findIndex(n => !n)
    store.selectedIndex = empty
    const digit = store.puzzle!.solution[empty]!
    store.notesMode = true; store.enterDigit(digit)
    expect(store.currentGame!.notes[empty]).toBe(1 << digit)
    const empty2 = store.puzzle!.givens.findIndex((n, i) => !n && i !== empty)
    store.selectedIndex = empty2; store.notesMode = false; store.enterDigit(store.puzzle!.solution[empty2]!)
    stop()
    setActivePinia(createPinia())
    const restored = useSudokuStore(); restored.hydrate(storage)
    await restored.openGame('2026-10-02', restored.preferredDifficulty)
    expect(restored.difficulty).toBe('medium')
    expect(restored.preferences.highlightMatching).toBe(true)
    expect(restored.currentGame!.values[empty2]).toBe(store.puzzle!.solution[empty2])
    expect(restored.currentGame!.notes[empty]).toBe(1 << digit)
  })

  it('protege los números iniciales y deshace valores y notas', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'easy')
    const fixed = store.puzzle!.givens.findIndex(n => n > 0)
    store.selectedIndex = fixed; store.enterDigit(9); store.erase()
    expect(store.currentGame!.values[fixed]).toBe(store.puzzle!.givens[fixed])
    const empty = store.puzzle!.givens.findIndex(n => !n)
    store.selectedIndex = empty; store.enterDigit(3); store.undo()
    expect(store.currentGame!.values[empty]).toBe(0)
    store.notesMode = true; store.enterDigit(4); store.undo()
    expect(store.currentGame!.notes[empty]).toBe(0)
  })

  it('detecta la victoria real y acredita solo el tablero del mismo día', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'easy')
    for (const [index, value] of store.puzzle!.solution.entries()) {
      if (store.puzzle!.givens[index]) continue
      store.selectedIndex = index; store.enterDigit(value)
    }
    expect(store.currentGame!.completedOn).toBe('2026-10-02')
    expect(store.stats.current).toBe(1)
    await store.openGame('2026-10-01', 'easy')
    store.currentGame!.values = [...store.puzzle!.solution]; store.finishIfSolved()
    expect(store.stats.current).toBe(1)
    expect(store.stats.total).toBe(2)
  })

  it('no acredita el día anterior cuando terminas después de medianoche', async () => {
    const store = useSudokuStore(); await store.openGame('2026-10-02', 'easy')
    store.currentGame!.values = [...store.puzzle!.solution]
    vi.setSystemTime(new Date(2026, 9, 3, 0, 1)); store.finishIfSolved()
    expect(store.currentGame!.completedOn).toBe('2026-10-03')
    expect(store.stats.current).toBe(0)
    expect(store.isHistorical).toBe(true)
  })

  it('rechaza fechas futuras y sobrevive a un guardado corrupto o lleno', async () => {
    const store = useSudokuStore()
    await store.openGame('2026-10-03', 'easy')
    expect(store.puzzle).toBeNull(); expect(store.error).toBeTruthy()
    storage.setItem(STORAGE_KEY, '{no es JSON')
    store.hydrate(storage); expect(store.storageError).toBeTruthy()
    setActivePinia(createPinia())
    const other = useSudokuStore()
    persistSudoku(other, { setItem() { throw new Error('QuotaExceededError') } })
    await other.openGame('2026-10-02', 'easy')
    expect(other.storageError).toBeTruthy(); expect(other.puzzle).not.toBeNull()
  })
})

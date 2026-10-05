import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useExternalSudokuStore } from '../src/stores/external-sudoku'
import { useSudokuStore } from '../src/stores/sudoku'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import ExternalSolverView from '../src/views/ExternalSolverView.vue'

beforeEach(() => setActivePinia(createPinia()))
describe('sudoku externo', () => {
  it('edita, borra y deshace sin afectar al sudoku diario', () => {
    const store = useExternalSudokuStore(), daily = useSudokuStore()
    store.enterDigit(5, 0); store.enterDigit(4, 1); store.enterDigit(0, 0)
    expect(store.values.slice(0, 2)).toEqual([0, 4])
    store.undo(); expect(store.values.slice(0, 2)).toEqual([5, 4])
    store.clear(); expect(store.values.every(n => n === 0)).toBe(true)
    store.undo(); expect(store.values.slice(0, 2)).toEqual([5, 4])
    expect(daily.games).toEqual({}); expect(daily.stats.total).toBe(0)
  })
  it('obliga a revisar el OCR y permite deshacer la sustitución', () => {
    const store = useExternalSudokuStore(), values = Array<number>(81).fill(0)
    store.enterDigit(3, 0); values[0] = 7
    store.importPhoto({ values, uncertain: [0, 10] })
    expect(store.needsReview).toBe(true)
    store.enterDigit(8, 0); expect(store.uncertain).toEqual([10])
    store.confirmReview(); expect(store.needsReview).toBe(false)
    store.undo(); expect(store.needsReview).toBe(true)
    store.undo(); expect(store.values[0]).toBe(7)
    store.undo(); expect(store.values[0]).toBe(3); expect(store.needsReview).toBe(false)
  })
  it('valida el guardado y conserva las lecturas pendientes tras recarga', () => {
    const store = useExternalSudokuStore(), values = Array<number>(81).fill(0)
    values[0] = 9
    store.hydrate({ getItem: () => JSON.stringify({ schema: 1, values, uncertain: [2], needsReview: true }) })
    expect(store.values[0]).toBe(9); expect(store.needsReview).toBe(true); expect(store.uncertain).toEqual([2])
    setActivePinia(createPinia())
    const invalid = useExternalSudokuStore()
    invalid.hydrate({ getItem: () => '{invalid' })
    expect(invalid.storageError).not.toBe(''); expect(invalid.values).toHaveLength(81)
  })
  it('renderiza casillas editables, pistas y selección de cámara o archivo', async () => {
    const app = createSSRApp(ExternalSolverView); app.use(createPinia())
    const html = await renderToString(app)
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(81)
    expect(html).toContain('inputmode="numeric"')
    expect(html).toContain('Pedir una pista')
    expect(html).toContain('capture="environment"')
    expect(html).toContain('Elegir imagen')
  })
})

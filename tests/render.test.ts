import { describe, expect, it } from 'vitest'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'
import { createPinia } from 'pinia'
import App from '../src/App.vue'
import { useSudokuStore } from '../src/stores/sudoku'
import SettingsPanel from '../src/components/SettingsPanel.vue'
import { DIFFICULTY_PROFILES } from '../src/domain/sudoku'

describe('composición de la interfaz', () => {
  it('muestra la dificultad real del tablero de reserva y conserva el nivel elegido para reabrirlo', async () => {
    const pinia = createPinia()
    const store = useSudokuStore(pinia)
    const attempts = DIFFICULTY_PROFILES.medium.maximumAttempts
    try {
      DIFFICULTY_PROFILES.medium.maximumAttempts = 1
      await store.openGame('2026-10-01', 'medium')
      expect(store.puzzle!.rating).toBe('singles')
      expect(store.puzzle?.version === 'v2' && store.puzzle.analysis.solved).toBe(true)
      const id = store.puzzle!.id
      const empty = store.puzzle!.givens.findIndex(value => !value)
      store.selectedIndex = empty; store.enterDigit(store.puzzle!.solution[empty]!)
      await store.openGame('2026-10-01', 'medium')
      expect(store.currentGame!.values[empty]).toBe(store.puzzle!.solution[empty])
      expect(store.puzzle!.id).toBe(id)
      expect(store.difficulty).toBe('medium')
      expect(store.currentGame!.difficulty).toBe('medium')
      const app = createSSRApp(App); app.use(pinia)
      const html = await renderToString(app)
      expect(html).toMatch(/class="board-meta"[^]*?Fácil/)
      expect(html).toContain('Has elegido Media. Este tablero tiene dificultad Fácil.')
      expect(html).toContain('Candidatos únicos y únicos ocultos.')
      expect(html).not.toContain('Añade pares y candidatos bloqueados.')
    } finally { DIFFICULTY_PROFILES.medium.maximumAttempts = attempts }
  })

  it('renderiza las 81 casillas y los controles shadcn-vue con una partida real', async () => {
    const pinia = createPinia()
    const app = createSSRApp(App); app.use(pinia)
    const store = useSudokuStore(pinia)
    await store.openGame(store.today, 'easy')
    const html = await renderToString(app)
    expect((html.match(/role="gridcell"/g) ?? []).length).toBe(81)
    expect((html.match(/role="row"/g) ?? []).length).toBe(9)
    expect(html).toContain('data-slot="select-trigger"')
    expect(html).toContain('data-slot="button"')
    expect(html).not.toContain('data-slot="progress"')
    expect(html).not.toContain('digit-count')
    expect(html).not.toContain('digit-finished')
    expect(html).not.toContain('cell-related')
    expect(html).not.toContain('cell-same')
    expect(html).not.toContain('cell-conflict')
    expect(html).toContain('aria-label="Configuración"')
    expect(html).toContain('Tu calendario')
    expect(html).not.toContain('Preparando tu sudoku')
  })

  it('las ayudas se pueden activar, incluidos los conflictos y contadores', async () => {
    const pinia = createPinia()
    const app = createSSRApp(App); app.use(pinia)
    const store = useSudokuStore(pinia)
    await store.openGame(store.today, 'hard')
    const empty = store.puzzle!.givens.findIndex(n => !n)
    const row = Math.floor(empty / 9)
    const peer = store.puzzle!.givens.findIndex((n, i) => n > 0 && Math.floor(i / 9) === row)
    store.selectedIndex = empty
    store.enterDigit(peer >= 0 ? store.puzzle!.givens[peer]! : 1)
    // Ensure a duplicate even if this row happened to contain no initial clues.
    const other = row * 9 + (empty % 9 + 1) % 9
    store.currentGame!.values[other] = store.currentGame!.values[empty]!
    let html = await renderToString(app)
    expect(html).not.toContain('cell-conflict')
    expect(html).not.toContain(', conflicto')
    Object.assign(store.preferences, { highlightMatching: true, highlightRelated: true, showConflicts: true, showRemainingCounts: true, showProgress: true })
    const enabledApp = createSSRApp(App); enabledApp.use(pinia)
    html = await renderToString(enabledApp)
    for (const text of ['cell-same', 'cell-related', 'cell-conflict', 'digit-count', 'data-slot="progress"', ', conflicto']) expect(html).toContain(text)
  })

  it('la configuración ofrece las ayudas y la transferencia de progreso', async () => {
    const app = createSSRApp(SettingsPanel); app.use(createPinia())
    const html = await renderToString(app)
    expect((html.match(/role="switch"/g) ?? []).length).toBe(6)
    expect(html).toContain('Dificultad predeterminada')
    expect(html).toContain('Exportar progreso')
    expect(html).toContain('Elegir archivo')
    expect(html).toContain('type="file"')
  })

  it('muestra la victoria del archivo sin acreditar racha', async () => {
    const pinia = createPinia()
    const app = createSSRApp(App); app.use(pinia)
    const store = useSudokuStore(pinia)
    await store.openGame('2024-02-29', 'medium')
    store.currentGame!.values = [...store.puzzle!.solution]
    store.finishIfSolved()
    const html = await renderToString(app)
    expect(html).toContain('¡Sudoku resuelto!')
    expect(html).toContain('Tu racha sigue igual.')
    expect(store.stats.current).toBe(0)
  })
})

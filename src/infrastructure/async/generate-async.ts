import { generateSudoku, type Difficulty, type SudokuPuzzle } from '../../domain/sudoku'
import type { DateKey } from '../../domain/dates'

/** Keep the UI responsive during uniqueness checks. Node/tests use the same pure engine. */
export function generatePuzzleAsync(date: DateKey, difficulty: Difficulty, signal?: AbortSignal): Promise<SudokuPuzzle> {
  if (typeof Worker === 'undefined') return Promise.resolve(generateSudoku(date, difficulty))
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/sudoku.worker.ts', import.meta.url), { type: 'module' })
    const stop = () => { clearTimeout(timeout); worker.terminate(); signal?.removeEventListener('abort', abort) }
    const abort = () => { stop(); reject(new DOMException('Generación cancelada', 'AbortError')) }
    const timeout = setTimeout(() => { stop(); reject(new Error('La generación está tardando demasiado. Vuelve a intentarlo.')) }, 30_000)
    worker.onmessage = (event: MessageEvent<{ puzzle?: SudokuPuzzle; error?: string }>) => {
      stop()
      if (event.data.puzzle) resolve(event.data.puzzle)
      else reject(new Error(event.data.error ?? 'No se pudo generar el sudoku'))
    }
    worker.onerror = () => { stop(); reject(new Error('No se pudo iniciar el generador de sudokus.')) }
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) { abort(); return }
    worker.postMessage({ requestId: 1, date, difficulty })
  })
}

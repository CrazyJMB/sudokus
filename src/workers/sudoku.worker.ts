import { generateSudoku, type Difficulty } from '../lib/sudoku'
import type { DateKey } from '../lib/dates'
import { validateImportedGames } from '../lib/persistence'
import type { SavedGame } from '../lib/history'

self.onmessage = (event: MessageEvent<{ requestId: number; date: DateKey; difficulty: Difficulty } | { kind: 'validate-import'; requestId: number; games: Record<string, SavedGame> }>) => {
  const { requestId } = event.data
  try {
    if ('kind' in event.data && event.data.kind === 'validate-import') {
      validateImportedGames(event.data.games, (done, total) => self.postMessage({ requestId, progress: { done, total } }))
      self.postMessage({ requestId, valid: true })
    } else {
      const { date, difficulty } = event.data as { date: DateKey; difficulty: Difficulty }
      self.postMessage({ requestId, puzzle: generateSudoku(date, difficulty) })
    }
  }
  catch (error) { self.postMessage({ requestId, error: error instanceof Error ? error.message : 'Error al generar el sudoku' }) }
}

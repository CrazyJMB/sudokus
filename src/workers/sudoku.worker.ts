import { generatePuzzleForVersion, type Difficulty, type GeneratorVersion } from '../domain/sudoku'
import type { DateKey } from '../domain/dates'
import { validateImportedGames } from '../domain/storage'
import type { SavedGame } from '../domain/history'

self.onmessage = (event: MessageEvent<{ requestId: number; date: DateKey; difficulty: Difficulty; version?: GeneratorVersion } | { kind: 'validate-import'; requestId: number; games: Record<string, SavedGame> }>) => {
  const { requestId } = event.data
  try {
    if ('kind' in event.data && event.data.kind === 'validate-import') {
      validateImportedGames(event.data.games, (done, total) => self.postMessage({ requestId, progress: { done, total } }))
      self.postMessage({ requestId, valid: true })
    } else {
      const { date, difficulty, version } = event.data as { date: DateKey; difficulty: Difficulty; version?: GeneratorVersion }
      self.postMessage({ requestId, puzzle: generatePuzzleForVersion(date, difficulty, version) })
    }
  }
  catch (error) { self.postMessage({ requestId, error: error instanceof Error ? error.message : 'Error al generar el sudoku' }) }
}

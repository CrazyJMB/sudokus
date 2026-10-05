import { parseBackup, validateImportedGames, type ProgressBackup } from '../../domain/storage'

/** Large histories are verified in a Worker, with no updates to the live store. */
export async function prepareBackup(text: string, onProgress?: (done: number, total: number) => void): Promise<ProgressBackup> {
  const backup = parseBackup(text)
  if (typeof Worker === 'undefined') {
    validateImportedGames(backup.data.games, onProgress)
    return backup
  }
  await new Promise<void>((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/sudoku.worker.ts', import.meta.url), { type: 'module' })
    const stop = () => { clearTimeout(timeout); worker.terminate() }
    const timeout = setTimeout(() => { stop(); reject(new Error('La comprobación ha tardado demasiado. No se ha importado nada.')) }, 120_000)
    worker.onmessage = (event: MessageEvent<{ progress?: { done: number; total: number }; valid?: boolean; error?: string }>) => {
      if (event.data.progress) { onProgress?.(event.data.progress.done, event.data.progress.total); return }
      stop()
      if (event.data.valid) resolve()
      else reject(new Error(event.data.error ?? 'El archivo contiene partidas incompatibles.'))
    }
    worker.onerror = () => { stop(); reject(new Error('No se pudo comprobar el archivo. No se ha importado nada.')) }
    worker.postMessage({ kind: 'validate-import', requestId: 1, games: backup.data.games })
  })
  return backup
}

import type { Worker } from 'tesseract.js'
import { inkThreshold, perspectiveMap, type Point } from './geometry'

export interface PhotoResult { values: number[]; uncertain: number[] }

function canvas(width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas')
  result.width = width; result.height = height
  return result
}
function context(target: HTMLCanvasElement) {
  const ctx = target.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No se pueden procesar imágenes en este navegador.')
  return ctx
}

export async function loadPhoto(file: File): Promise<HTMLCanvasElement> {
  if (!file.type.startsWith('image/')) throw new Error('Elige una imagen JPG, PNG o WebP.')
  if (file.size > 20 * 1024 * 1024) throw new Error('La foto supera los 20 MB. Elige una imagen más pequeña.')
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight))
    const target = canvas(Math.max(1, Math.round(img.naturalWidth * scale)), Math.max(1, Math.round(img.naturalHeight * scale)))
    const ctx = context(target)
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, target.width, target.height)
    ctx.drawImage(img, 0, 0, target.width, target.height)
    return target
  } catch {
    throw new Error('No se pudo abrir la foto. Prueba con JPG, PNG o WebP.')
  } finally { URL.revokeObjectURL(url) }
}

export function rotatePhoto(source: HTMLCanvasElement): HTMLCanvasElement {
  const target = canvas(source.height, source.width), ctx = context(target)
  ctx.translate(target.width, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(source, 0, 0)
  return target
}

export function rectifyPhoto(source: HTMLCanvasElement, corners: Point[]): HTMLCanvasElement {
  const map = perspectiveMap(corners), size = 720
  const original = context(source).getImageData(0, 0, source.width, source.height)
  const target = canvas(size, size), ctx = context(target), output = ctx.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const p = map((x + 0.5) / size, (y + 0.5) / size)
    const sx = Math.max(0, Math.min(source.width - 1, Math.round(p.x * (source.width - 1))))
    const sy = Math.max(0, Math.min(source.height - 1, Math.round(p.y * (source.height - 1))))
    const from = (sy * source.width + sx) * 4, to = (y * size + x) * 4
    output.data[to] = original.data[from]!; output.data[to + 1] = original.data[from + 1]!; output.data[to + 2] = original.data[from + 2]!; output.data[to + 3] = 255
  }
  ctx.putImageData(output, 0, 0)
  return target
}

function prepareCell(board: HTMLCanvasElement, index: number): { image: HTMLCanvasElement | null; uncertain: boolean } {
  // Trim grid lines; isolate the largest connected ink component to ignore dust and pencil notes.
  const size = 64, crop = canvas(size, size), ctx = context(crop)
  ctx.drawImage(board, (index % 9) * 80 + 8, Math.floor(index / 9) * 80 + 8, 64, 64, 0, 0, size, size)
  const pixels = ctx.getImageData(0, 0, size, size), grey = new Uint8Array(size * size)
  for (let i = 0; i < grey.length; i++) grey[i] = Math.round(pixels.data[i * 4]! * .299 + pixels.data[i * 4 + 1]! * .587 + pixels.data[i * 4 + 2]! * .114)
  const threshold = inkThreshold(grey), visited = new Uint8Array(grey.length)
  let largest: number[] = [], significant = 0
  for (let i = 0; i < grey.length; i++) {
    if (visited[i] || grey[i]! > threshold) continue
    const component = [i]; visited[i] = 1
    for (let k = 0; k < component.length; k++) {
      const at = component[k]!, x = at % size, y = Math.floor(at / size)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx!, ny = y + dy!, next = ny * size + nx
        if (nx < 0 || nx >= size || ny < 0 || ny >= size || visited[next] || grey[next]! > threshold) continue
        visited[next] = 1; component.push(next)
      }
    }
    if (component.length >= 20) significant++
    if (component.length > largest.length) largest = component
  }
  if (largest.length < 20) return { image: null, uncertain: largest.length > 6 }
  const xs = largest.map(i => i % size), ys = largest.map(i => Math.floor(i / size))
  const left = Math.min(...xs), top = Math.min(...ys), width = Math.max(...xs) - left + 1, height = Math.max(...ys) - top + 1
  if (height < size * .28 || width > size * .9 || height > size * .95) return { image: null, uncertain: true }
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = 'black'
  for (const i of largest) ctx.fillRect(i % size, Math.floor(i / size), 1, 1)
  const target = canvas(100, 120), output = context(target)
  output.fillStyle = 'white'; output.fillRect(0, 0, 100, 120)
  const scale = Math.min(64 / width, 80 / height)
  output.drawImage(crop, left, top, width, height, (100 - width * scale) / 2, (120 - height * scale) / 2, width * scale, height * scale)
  return { image: target, uncertain: significant > 1 }
}

function abortable<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('Cancelado', 'AbortError'))
    if (signal.aborted) { pending.catch(() => {}); abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    pending.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

export async function recognizeSudokuPhoto(board: HTMLCanvasElement, signal: AbortSignal, progress: (percent: number, label: string) => void): Promise<PhotoResult> {
  let worker: Worker | undefined
  const stop = () => { void worker?.terminate() }
  signal.addEventListener('abort', stop, { once: true })
  try {
    const { createWorker, PSM } = await abortable(import('tesseract.js'), signal)
    progress(0, 'Preparando el lector de números…')
    const pending = createWorker('eng', 1, {
      logger: info => { if (!signal.aborted && info.status === 'loading language traineddata') progress(Math.round(info.progress * 15), 'Descargando el lector por primera vez…') },
      errorHandler: () => {},
    })
    // Initialization cannot be interrupted by Tesseract; release a late worker after cancellation.
    void pending.then(created => { if (signal.aborted) void created.terminate() }, () => {})
    worker = await abortable(pending, signal)
    await abortable(worker.setParameters({ tessedit_char_whitelist: '123456789', tessedit_pageseg_mode: PSM.SINGLE_CHAR }), signal)
    const values = Array<number>(81).fill(0), uncertain: number[] = []
    for (let i = 0; i < 81; i++) {
      signal.throwIfAborted()
      const cell = prepareCell(board, i)
      if (cell.image) {
        let { data } = await abortable(worker.recognize(cell.image), signal)
        // Some typefaces' isolated 7/9 are rejected by single-character segmentation.
        // A second segmentation reads the same pixels; never fill gaps using a solution.
        if (!/^[1-9]$/.test(data.text.trim()) || data.confidence < 65) {
          await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE }), signal)
          const alternative = (await abortable(worker.recognize(cell.image), signal)).data
          if (/^[1-9]$/.test(alternative.text.trim()) && (!/^[1-9]$/.test(data.text.trim()) || alternative.confidence > data.confidence)) data = alternative
          await abortable(worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR }), signal)
        }
        const text = data.text.trim()
        if (/^[1-9]$/.test(text)) values[i] = Number(text)
        if (!values[i] || data.confidence < 65 || cell.uncertain) uncertain.push(i)
      } else if (cell.uncertain) uncertain.push(i)
      progress(Math.round(15 + (i + 1) / 81 * 85), `Leyendo casilla ${i + 1} de 81…`)
    }
    return { values, uncertain }
  } finally {
    signal.removeEventListener('abort', stop)
    if (worker) await worker.terminate()
  }
}

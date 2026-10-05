<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { Camera, ImagePlus, LoaderCircle, RotateCw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { loadPhoto, recognizeSudokuPhoto, rectifyPhoto, rotatePhoto, type PhotoResult } from '@/infrastructure/ocr/sudoku-photo'
import { validCorners, type Point } from '@/infrastructure/ocr/geometry'

const emit = defineEmits<{ imported: [result: PhotoResult] }>()
const cameraInput = ref<HTMLInputElement | null>(null), fileInput = ref<HTMLInputElement | null>(null)
const photo = shallowRef<HTMLCanvasElement | null>(null), rectified = shallowRef<HTMLCanvasElement | null>(null)
const photoUrl = ref(''), rectifiedUrl = ref(''), corners = ref<Point[]>([])
const cursor = ref<Point>({ x: .1, y: .1 })
const loading = ref(false), busy = ref(false), error = ref(''), status = ref(''), percent = ref(0)
const result = ref<PhotoResult | null>(null)
const labels = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda']
const instruction = computed(() => corners.value.length < 4 ? `Marca la esquina ${labels[corners.value.length]} del borde exterior del sudoku.` : 'Comprueba que las líneas de la vista recortada coinciden con las casillas.')
let controller: AbortController | null = null, loadRequest = 0

function resetCorners() {
  corners.value = []; rectified.value = null; rectifiedUrl.value = ''; result.value = null; error.value = ''; status.value = ''; cursor.value = { x: .1, y: .1 }
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  input.value = ''
  if (!file) return
  const current = ++loadRequest
  loading.value = true; error.value = ''
  try {
    const loaded = await loadPhoto(file)
    if (current !== loadRequest) return
    resetCorners(); photo.value = loaded; photoUrl.value = loaded.toDataURL('image/jpeg', .9)
  } catch (cause) { if (current === loadRequest) error.value = cause instanceof Error ? cause.message : 'No se pudo abrir la foto.' }
  finally { if (current === loadRequest) loading.value = false }
}
function addCorner(point: Point) {
  if (busy.value || corners.value.length >= 4) return
  corners.value.push(point)
  cursor.value = [{ x: .9, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }, point][corners.value.length - 1]!
  if (corners.value.length === 4 && photo.value) {
    if (!validCorners(corners.value)) { error.value = 'Las esquinas se cruzan o el área es demasiado pequeña. Vuelve a marcarlas en el orden indicado.'; return }
    rectified.value = rectifyPhoto(photo.value, corners.value)
    rectifiedUrl.value = rectified.value.toDataURL('image/jpeg', .9)
  }
}
function clickPhoto(event: MouseEvent) {
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  addCorner({ x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) })
}
function keyPhoto(event: KeyboardEvent) {
  if (busy.value || corners.value.length >= 4) return
  const delta = event.shiftKey ? .05 : .005
  const moves: Record<string, Point> = { ArrowLeft: { x: -delta, y: 0 }, ArrowRight: { x: delta, y: 0 }, ArrowUp: { x: 0, y: -delta }, ArrowDown: { x: 0, y: delta } }
  if (event.key in moves) {
    event.preventDefault(); const move = moves[event.key]!
    cursor.value = { x: Math.max(0, Math.min(1, cursor.value.x + move.x)), y: Math.max(0, Math.min(1, cursor.value.y + move.y)) }
  } else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addCorner({ ...cursor.value }) }
}
function rotate() {
  if (!photo.value) return
  photo.value = rotatePhoto(photo.value); photoUrl.value = photo.value.toDataURL('image/jpeg', .9); resetCorners()
}
async function recognize() {
  if (!rectified.value || busy.value) return
  controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => controller?.abort(new Error('La lectura está tardando demasiado. Comprueba la conexión o prueba una foto más nítida.')), 120_000)
  busy.value = true; error.value = ''; result.value = null; percent.value = 0
  try {
    const read = await recognizeSudokuPhoto(rectified.value, signal, (value, label) => { percent.value = value; status.value = label })
    if (signal.aborted) return
    if (!read.values.some(Boolean)) throw new Error('No se reconocieron números. Revisa las esquinas, la orientación y la nitidez de la foto.')
    result.value = read; status.value = 'Lectura terminada. Puedes llevarla al tablero para revisarla.'
  } catch (cause) {
    if (signal.aborted && signal.reason instanceof DOMException && signal.reason.name === 'AbortError') status.value = 'Lectura cancelada.'
    else { error.value = cause instanceof Error ? cause.message : 'No se pudo leer la foto. Comprueba la conexión e inténtalo de nuevo.'; status.value = '' }
  } finally { clearTimeout(timer); busy.value = false; controller = null }
}
function useResult() {
  if (!result.value) return
  emit('imported', result.value); result.value = null; status.value = 'Foto incorporada. Revisa el tablero antes de pedir una pista.'
}
function cancel() { controller?.abort() }
onBeforeUnmount(() => { ++loadRequest; controller?.abort() })
</script>

<template>
  <section class="photo-import" aria-label="Importar sudoku desde una foto">
    <h2>Desde una foto</h2>
    <p>Fotografía el sudoku completo, con buena luz y los números orientados hacia arriba. Funciona mejor con números impresos; revisa especialmente los escritos a mano y las notas pequeñas.</p>
    <input ref="cameraInput" class="sr-only" tabindex="-1" type="file" accept="image/*" capture="environment" aria-label="Hacer una foto del sudoku" @change="chooseFile" />
    <input ref="fileInput" class="sr-only" tabindex="-1" type="file" accept="image/*" aria-label="Elegir foto del sudoku" @change="chooseFile" />
    <div class="solver-actions"><Button variant="outline" :disabled="busy || loading" @click="cameraInput?.click()"><Camera :size="17" />Hacer foto</Button><Button variant="outline" :disabled="busy || loading" @click="fileInput?.click()"><ImagePlus :size="17" />Elegir imagen</Button></div>
    <p class="hint-caption">La foto se procesa en este dispositivo. El lector necesita internet para descargar sus archivos la primera vez.</p>
    <p v-if="loading" role="status">Abriendo foto…</p>
    <template v-if="photoUrl">
      <p id="photo-corner-help" aria-live="polite">{{ instruction }}</p>
      <div class="photo-stage" role="button" tabindex="0" :aria-label="instruction" aria-describedby="photo-corner-help" :aria-disabled="busy || corners.length === 4" @click="clickPhoto" @keydown="keyPhoto">
        <img :src="photoUrl" alt="Foto original del sudoku para marcar sus cuatro esquinas" draggable="false" />
        <svg class="photo-guides" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon v-if="corners.length === 4" :points="corners.map(p => `${p.x * 100},${p.y * 100}`).join(' ')" /></svg>
        <span v-for="(point, i) in corners" :key="i" class="photo-corner" :style="{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }">{{ i + 1 }}</span>
        <span v-if="corners.length < 4" class="photo-cursor" :style="{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }" aria-hidden="true">+</span>
      </div>
      <p class="hint-caption">Pulsa las esquinas o usa las flechas y Enter con la imagen enfocada. Mayús + flechas mueve más rápido.</p>
      <div class="solver-actions"><Button variant="ghost" :disabled="busy" @click="rotate"><RotateCw :size="16" />Girar foto</Button><Button variant="ghost" :disabled="busy" @click="resetCorners">Volver a marcar</Button></div>
      <div v-if="rectifiedUrl" class="photo-stage photo-rectified"><img :src="rectifiedUrl" alt="Sudoku recortado y corregido para leer sus 81 casillas" /><svg class="photo-guides" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true"><template v-for="i in 8" :key="i"><line :x1="i" y1="0" :x2="i" y2="9" /><line x1="0" :y1="i" x2="9" :y2="i" /></template></svg></div>
      <div class="solver-actions"><Button v-if="rectifiedUrl" :disabled="busy" @click="recognize"><LoaderCircle v-if="busy" class="loading-icon" :size="17" />Leer números</Button><Button v-if="busy" variant="outline" @click="cancel">Cancelar</Button></div>
    </template>
    <div v-if="busy" class="photo-progress"><progress :value="percent" max="100" aria-label="Progreso de lectura" /><span>{{ percent }} %</span></div>
    <p v-if="status" role="status">{{ status }}</p>
    <p v-if="error" class="transfer-error" role="alert">{{ error }}</p>
    <div v-if="result" class="photo-result"><p>{{ result.values.filter(Boolean).length }} números reconocidos; {{ result.uncertain.length }} casillas dudosas. La lectura sustituirá el tablero externo actual. Podrás deshacerla.</p><Button @click="useResult">Usar lectura y revisar</Button></div>
  </section>
</template>

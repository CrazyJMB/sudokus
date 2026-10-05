import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { findConflicts, type Grid } from '@/domain/sudoku'

export const EXTERNAL_STORAGE_KEY = 'sudoku-diario:external:v1'
interface Snapshot { values: Grid; uncertain: number[]; needsReview: boolean }
const validGrid = (value: unknown): value is Grid => Array.isArray(value) && value.length === 81 && Array.from(value).every(n => Number.isInteger(n) && n >= 0 && n <= 9)

export const useExternalSudokuStore = defineStore('external-sudoku', () => {
  const values = ref<Grid>(Array<number>(81).fill(0))
  const uncertain = ref<number[]>([])
  const needsReview = ref(false)
  const selectedIndex = ref(0)
  const undoStack = ref<Snapshot[]>([])
  const storageError = ref('')
  const conflicts = computed(() => findConflicts(values.value))
  let hydrated = false
  const snapshot = (): Snapshot => ({ values: [...values.value], uncertain: [...uncertain.value], needsReview: needsReview.value })
  function remember() { undoStack.value.push(snapshot()); if (undoStack.value.length > 100) undoStack.value.shift() }
  function restore(state: Snapshot) { values.value = [...state.values]; uncertain.value = [...state.uncertain]; needsReview.value = state.needsReview }
  function enterDigit(digit: number, index = selectedIndex.value) {
    if (!Number.isInteger(index) || index < 0 || index > 80 || !Number.isInteger(digit) || digit < 0 || digit > 9) return
    if (values.value[index] === digit && !uncertain.value.includes(index)) return
    remember(); values.value[index] = digit; uncertain.value = uncertain.value.filter(i => i !== index)
  }
  function importPhoto(result: { values: Grid; uncertain: number[] }) {
    if (!validGrid(result.values)) throw new Error('La lectura de la foto no es válida.')
    remember(); restore({ values: result.values, uncertain: result.uncertain.filter(i => Number.isInteger(i) && i >= 0 && i < 81), needsReview: true })
    selectedIndex.value = result.uncertain[0] ?? 0
  }
  function confirmReview() { remember(); needsReview.value = false; uncertain.value = [] }
  function clear() { remember(); restore({ values: Array<number>(81).fill(0), uncertain: [], needsReview: false }); selectedIndex.value = 0 }
  function undo() { const previous = undoStack.value.pop(); if (previous) restore(previous) }
  function hydrate(storage?: Pick<Storage, 'getItem'>) {
    if (hydrated) return
    try {
      const raw = (storage ?? window.localStorage).getItem(EXTERNAL_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.schema !== 1 || !validGrid(parsed.values) || !Array.isArray(parsed.uncertain) || parsed.uncertain.some((i: number) => !Number.isInteger(i) || i < 0 || i > 80) || typeof parsed.needsReview !== 'boolean') throw new Error('Guardado no válido')
        restore(parsed)
      }
    } catch { storageError.value = 'No se pudo leer el tablero externo guardado. Puedes usarlo durante esta sesión.' }
    hydrated = true
  }
  watch([values, uncertain, needsReview], () => {
    if (!hydrated || storageError.value || typeof window === 'undefined') return
    try { window.localStorage.setItem(EXTERNAL_STORAGE_KEY, JSON.stringify({ schema: 1, ...snapshot() })) }
    catch { storageError.value = 'No se pudo guardar este tablero. Se conservará mientras mantengas abierta la página.' }
  }, { deep: true })
  return { values, uncertain, needsReview, selectedIndex, undoStack, storageError, conflicts, enterDigit, importPhoto, confirmReview, clear, undo, hydrate }
})

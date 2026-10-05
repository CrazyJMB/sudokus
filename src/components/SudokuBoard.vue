<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useSudokuStore } from '@/stores/sudoku'
import { boxOf } from '@/domain/sudoku'

const store = useSudokuStore()
defineProps<{ hintCells?: number[] }>()
const board = ref<HTMLElement | null>(null)
const selectedValue = computed(() => store.selectedIndex === null ? 0 : store.currentGame?.values[store.selectedIndex] ?? 0)
function focusSelected() {
  nextTick(() => board.value?.querySelector<HTMLButtonElement>(`[data-cell="${store.selectedIndex}"]`)?.focus({ preventScroll: true }))
}
function choose(index: number) { store.selectedIndex = index }
function highlighted(index: number): boolean {
  const selected = store.selectedIndex
  return selected !== null && (Math.floor(index / 9) === Math.floor(selected / 9) || index % 9 === selected % 9 || boxOf(index) === boxOf(selected))
}
function keydown(event: KeyboardEvent) {
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); store.undo() }
    return
  }
  const index = store.selectedIndex ?? 0
  const row = Math.floor(index / 9), col = index % 9
  const move = { ArrowLeft: row * 9 + Math.max(0, col - 1), ArrowRight: row * 9 + Math.min(8, col + 1), ArrowUp: Math.max(0, row - 1) * 9 + col, ArrowDown: Math.min(8, row + 1) * 9 + col } as Record<string, number>
  if (event.key in move) { event.preventDefault(); choose(move[event.key]!); focusSelected() }
  else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); store.enterDigit(Number(event.key)) }
  else if (['Backspace', 'Delete', '0'].includes(event.key)) { event.preventDefault(); store.erase() }
  else if (event.key.toLowerCase() === 'n' && !store.currentGame?.completedAt) { event.preventDefault(); store.notesMode = !store.notesMode }
}
function cellLabel(i: number): string {
  const value = store.currentGame?.values[i] ?? 0
  const notes = Array.from({ length: 9 }, (_, n) => n + 1).filter(n => (store.currentGame?.notes[i] ?? 0) & (1 << n))
  return `Fila ${Math.floor(i / 9) + 1}, columna ${i % 9 + 1}: ${value || 'vacía'}${store.puzzle?.givens[i] ? ', número inicial' : ''}${notes.length ? `, notas ${notes.join(', ')}` : ''}${store.conflicts.has(i) ? ', conflicto' : ''}`
}
defineExpose({ focusSelected })
</script>

<template>
  <div ref="board" class="sudoku-board" :class="{ 'board-complete': store.currentGame?.completedAt }" role="grid" aria-label="Sudoku de 9 filas y 9 columnas" aria-rowcount="9" aria-colcount="9" aria-describedby="board-help" @keydown="keydown">
    <div v-for="row in 9" :key="row" class="sudoku-row" role="row">
      <button v-for="col in 9" :key="col" type="button" role="gridcell" class="sudoku-cell"
        :data-cell="(row - 1) * 9 + col - 1" :data-given="Boolean(store.puzzle?.givens[(row - 1) * 9 + col - 1])"
        :aria-rowindex="row" :aria-colindex="col" :aria-label="cellLabel((row - 1) * 9 + col - 1)"
        :aria-selected="store.selectedIndex === (row - 1) * 9 + col - 1" :aria-readonly="Boolean(store.puzzle?.givens[(row - 1) * 9 + col - 1] || store.currentGame?.completedAt)"
        :tabindex="store.selectedIndex === (row - 1) * 9 + col - 1 ? 0 : -1"
        :class="{
          'cell-given': store.puzzle?.givens[(row - 1) * 9 + col - 1],
          'cell-related': store.preferences.highlightRelated && highlighted((row - 1) * 9 + col - 1),
          'cell-same': store.preferences.highlightMatching && selectedValue && selectedValue === store.currentGame?.values[(row - 1) * 9 + col - 1],
          'cell-selected': store.selectedIndex === (row - 1) * 9 + col - 1,
          'cell-conflict': store.conflicts.has((row - 1) * 9 + col - 1),
          'cell-hint': hintCells?.includes((row - 1) * 9 + col - 1),
          'box-right': col === 3 || col === 6,
          'box-bottom': row === 3 || row === 6,
        }" @click="choose((row - 1) * 9 + col - 1)">
        <span v-if="store.currentGame?.values[(row - 1) * 9 + col - 1]" class="cell-number">{{ store.currentGame.values[(row - 1) * 9 + col - 1] }}</span>
        <span v-else class="cell-notes" aria-hidden="true">
          <span v-for="digit in 9" :key="digit">{{ (store.currentGame?.notes[(row - 1) * 9 + col - 1] ?? 0) & (1 << digit) ? digit : '' }}</span>
        </span>
      </button>
    </div>
  </div>
</template>

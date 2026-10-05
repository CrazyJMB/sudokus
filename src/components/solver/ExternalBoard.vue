<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { useExternalSudokuStore } from '@/stores/external-sudoku'
const props = defineProps<{ highlighted?: number[] }>()
const store = useExternalSudokuStore()
const board = ref<HTMLElement | null>(null)
function focusSelected() { nextTick(() => board.value?.querySelector<HTMLInputElement>(`[data-cell="${store.selectedIndex}"]`)?.focus({ preventScroll: true })) }
function input(event: Event, index: number) {
  const target = event.target as HTMLInputElement
  if (/^[1-9]?$/.test(target.value)) store.enterDigit(Number(target.value), index)
  target.value = store.values[index] ? String(store.values[index]) : ''
}
function keydown(event: KeyboardEvent) {
  const index = store.selectedIndex, row = Math.floor(index / 9), col = index % 9
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); store.undo(); return }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  const moves: Record<string, number> = { ArrowLeft: row * 9 + Math.max(0, col - 1), ArrowRight: row * 9 + Math.min(8, col + 1), ArrowUp: Math.max(0, row - 1) * 9 + col, ArrowDown: Math.min(8, row + 1) * 9 + col }
  if (event.key in moves) { event.preventDefault(); store.selectedIndex = moves[event.key]!; focusSelected() }
  else if (/^[1-9]$/.test(event.key)) { event.preventDefault(); store.enterDigit(Number(event.key)) }
  else if (['Delete', 'Backspace', '0'].includes(event.key)) { event.preventDefault(); store.enterDigit(0) }
}
defineExpose({ focusSelected })
</script>

<template>
  <div ref="board" class="sudoku-board external-board" role="grid" aria-label="Sudoku externo editable, 9 filas y 9 columnas" aria-describedby="external-board-help" @keydown="keydown">
    <div v-for="row in 9" :key="row" class="sudoku-row" role="row">
      <input v-for="col in 9" :key="col" class="sudoku-cell cell-number" type="text" inputmode="numeric" pattern="[1-9]" maxlength="1" autocomplete="off" role="gridcell"
        :data-cell="(row - 1) * 9 + col - 1" :value="store.values[(row - 1) * 9 + col - 1] || ''"
        :aria-label="`Fila ${row}, columna ${col}${store.uncertain.includes((row - 1) * 9 + col - 1) ? ', lectura por revisar' : ''}`"
        :aria-rowindex="row" :aria-colindex="col" :aria-invalid="store.conflicts.has((row - 1) * 9 + col - 1)"
        :aria-selected="store.selectedIndex === (row - 1) * 9 + col - 1" :tabindex="store.selectedIndex === (row - 1) * 9 + col - 1 ? 0 : -1"
        :class="{ 'box-right': col === 3 || col === 6, 'box-bottom': row === 3 || row === 6, 'cell-selected': store.selectedIndex === (row - 1) * 9 + col - 1, 'cell-hint': props.highlighted?.includes((row - 1) * 9 + col - 1), 'cell-review': store.uncertain.includes((row - 1) * 9 + col - 1), 'cell-conflict': store.conflicts.has((row - 1) * 9 + col - 1) }"
        @focus="store.selectedIndex = (row - 1) * 9 + col - 1; ($event.target as HTMLInputElement).select()" @input="input($event, (row - 1) * 9 + col - 1)" />
    </div>
  </div>
</template>

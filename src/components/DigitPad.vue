<script setup lang="ts">
import { computed } from 'vue'
import { Eraser, Pencil, Undo2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { useSudokuStore } from '@/stores/sudoku'
const store = useSudokuStore()
const emit = defineEmits<{ entered: [] }>()
const disabled = computed(() => store.loading || !store.currentGame || Boolean(store.currentGame.completedAt))
const counts = computed(() => Array.from({ length: 9 }, (_, n) => store.currentGame?.values.filter(value => value === n + 1).length ?? 0))
const editable = computed(() => store.selectedIndex !== null && !store.puzzle?.givens[store.selectedIndex])
function enter(digit: number) { store.enterDigit(digit); emit('entered') }
</script>

<template>
  <div class="digit-pad" aria-label="Números del sudoku">
    <Button v-for="digit in 9" :key="digit" variant="outline" class="digit-button" :class="{ 'digit-finished': store.preferences.showRemainingCounts && counts[digit - 1] === 9 }" :disabled="disabled || !editable" :aria-label="`${store.notesMode ? 'Alternar nota' : 'Introducir'} ${digit}`" @click="enter(digit)">{{ digit }}<span v-if="store.preferences.showRemainingCounts" class="digit-count" aria-hidden="true">{{ Math.max(0, 9 - counts[digit - 1]!) }}</span></Button>
  </div>
  <div class="board-tools">
    <Button variant="ghost" class="tool-button" :class="{ 'tool-active': store.notesMode }" :disabled="disabled" :aria-pressed="store.notesMode" @click="store.notesMode = !store.notesMode; emit('entered')"><Pencil :size="17" /> Notas <kbd>N</kbd></Button>
    <Button variant="ghost" class="tool-button" :disabled="disabled || !editable" @click="store.erase(); emit('entered')"><Eraser :size="17" /> Borrar</Button>
    <Button variant="ghost" class="tool-button" :disabled="disabled || !store.undoStack.length" @click="store.undo(); emit('entered')"><Undo2 :size="17" /> Deshacer</Button>
  </div>
</template>

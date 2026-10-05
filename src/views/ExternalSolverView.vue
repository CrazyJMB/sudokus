<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ChevronLeft, Eraser, Lightbulb, Undo2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ExternalBoard from '@/components/solver/ExternalBoard.vue'
import PhotoImport from '@/components/solver/PhotoImport.vue'
import HintPanel from '@/components/hints/HintPanel.vue'
import { useExternalSudokuStore } from '@/stores/external-sudoku'
import { useLogicalHints } from '@/composables/useLogicalHints'
const emit = defineEmits<{ close: [] }>()
const store = useExternalSudokuStore()
const { hint, highlightedCells, requestHint, clearHint } = useLogicalHints(computed(() => store.values))
const board = ref<InstanceType<typeof ExternalBoard> | null>(null), heading = ref<HTMLElement | null>(null)
const confirmClear = ref(false)
function enter(digit: number) { store.enterDigit(digit); board.value?.focusSelected() }
onMounted(() => { store.hydrate(); heading.value?.focus() })
</script>

<template>
  <main class="solver-page">
    <Button variant="ghost" class="settings-back" @click="emit('close')"><ChevronLeft :size="18" />Volver al sudoku diario</Button>
    <div class="settings-heading"><p class="eyebrow">Aprende paso a paso</p><h1 ref="heading" tabindex="-1">Tu sudoku, con ayuda</h1><p>Introduce los números de un sudoku de papel, de otra página o de una foto. Descubre cómo continuar con pistas razonadas.</p></div>
    <div class="solver-layout">
      <section class="solver-board-section" aria-label="Tablero externo">
        <div v-if="store.storageError" class="storage-alert" role="alert">{{ store.storageError }}</div>
        <div class="game-card">
          <div class="board-meta"><span><span class="puzzle-indicator"></span>Sudoku externo</span><span>{{ store.values.filter(Boolean).length }} / 81</span></div>
          <ExternalBoard ref="board" :highlighted="highlightedCells" />
          <div class="digit-pad"><Button v-for="digit in 9" :key="digit" variant="outline" class="digit-button" :aria-label="`Introducir ${digit}`" @click="enter(digit)">{{ digit }}</Button></div>
          <div class="board-tools"><Button variant="ghost" class="tool-button" @click="enter(0)"><Eraser :size="17" />Borrar</Button><Button variant="ghost" class="tool-button" :disabled="!store.undoStack.length" @click="store.undo()"><Undo2 :size="17" />Deshacer</Button></div>
        </div>
        <p id="external-board-help" class="hint-caption">Todas las casillas son editables. Usa el teclado o los botones. Las flechas cambian de casilla; Supr borra y Ctrl/Cmd + Z deshace.</p>
        <p v-if="store.conflicts.size" class="transfer-error" role="alert">Hay números repetidos en las casillas rojas. Corrígelos antes de continuar.</p>
        <div v-if="store.needsReview" class="photo-review"><strong>Revisa la lectura de la foto</strong><p>Compara todas las casillas con el original, incluidas las vacías. Las casillas ámbar son lecturas dudosas. Puedes editar cualquier número.</p><Button :disabled="!!store.conflicts.size" @click="store.confirmReview()">He revisado los números</Button></div>
        <div class="solver-actions"><Button class="hint-trigger" :disabled="store.needsReview" @click="requestHint"><Lightbulb :size="18" />Pedir una pista</Button><Button variant="ghost" :disabled="!store.values.some(Boolean) && !store.uncertain.length" @click="confirmClear = true">Vaciar tablero</Button></div>
        <div v-if="confirmClear" class="clear-confirm"><p>¿Vaciar este tablero externo?</p><div class="solver-actions"><Button variant="outline" @click="store.clear(); clearHint(); confirmClear = false">Vaciar</Button><Button variant="ghost" @click="confirmClear = false">Cancelar</Button></div></div>
        <HintPanel v-if="hint" :hint="hint" @close="clearHint" />
        <p class="hint-caption">Este tablero se guarda por separado en este navegador y no cuenta para el historial ni las rachas.</p>
      </section>
      <aside class="solver-photo-section"><PhotoImport @imported="store.importPhoto($event); clearHint()" /></aside>
    </div>
  </main>
</template>

<script setup lang="ts">
import { Lightbulb, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { cellName, type LogicalHint } from '@/domain/sudoku/hints'
defineProps<{ hint: LogicalHint }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <section class="hint-panel" aria-label="Pista razonada">
    <div class="hint-heading"><Lightbulb :size="18" /><strong>Paso a paso</strong><Button variant="ghost" size="icon" aria-label="Cerrar pista" @click="$emit('close')"><X :size="17" /></Button></div>
    <p role="status">{{ hint.message }}</p>
    <ol v-if="hint.steps.length" class="hint-steps">
      <li v-for="(step, index) in hint.steps" :key="index"><strong>{{ step.title }}</strong><p>{{ step.explanation }}</p></li>
    </ol>
    <p v-if="hint.status === 'placement' || hint.status === 'elimination'" class="hint-caption">F = fila · C = columna. Cuenta desde arriba y desde la izquierda. Los bloques se numeran de izquierda a derecha, de arriba abajo.</p>
    <details v-if="hint.status === 'elimination'" class="hint-candidates"><summary>Ver candidatos restantes en las casillas señaladas</summary><ul><li v-for="cell in hint.cells" :key="cell">{{ cellName(cell) }}: {{ hint.candidates[cell]?.join(', ') }}</li></ul></details>
    <p class="hint-caption">Las pistas parten de los números que has escrito. Revisa cualquier entrada dudosa. Tú decides cuándo rellenar la casilla.</p>
  </section>
</template>

<script setup lang="ts">
import { Lightbulb, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { cellName, type LogicalHint } from '@/domain/sudoku/hints'
withDefaults(defineProps<{ hint: LogicalHint; level?: number }>(), { level: 0 })
defineEmits<{ close: []; more: [] }>()
</script>

<template>
  <section class="hint-panel" aria-label="Pista razonada">
    <div class="hint-heading"><Lightbulb :size="18" /><strong>{{ level === 2 ? 'La deducción' : 'Una pista' }}</strong><Button variant="ghost" size="icon" aria-label="Cerrar pista" @click="$emit('close')"><X :size="17" /></Button></div>
    <template v-if="hint.guidance && level < 2">
      <p role="status">{{ level === 0 ? hint.guidance.prompt : hint.guidance.nudge }}</p>
      <Button variant="outline" class="hint-trigger" @click="$emit('more')">{{ level === 0 ? 'Otra pista' : 'Ver la respuesta' }}</Button>
    </template>
    <template v-else>
    <p role="status">{{ hint.message }}</p>
    <ol v-if="hint.steps.length" class="hint-steps">
      <li v-for="(step, index) in hint.steps" :key="index"><strong>{{ step.title }}</strong><p>{{ step.explanation }}</p></li>
    </ol>
    <p v-if="hint.status === 'placement' || hint.status === 'elimination'" class="hint-caption">F = fila · C = columna. Cuenta desde arriba y desde la izquierda. Los bloques se numeran de izquierda a derecha, de arriba abajo.</p>
    <details v-if="hint.status === 'elimination'" class="hint-candidates"><summary>Ver candidatos restantes en las casillas señaladas</summary><ul><li v-for="cell in hint.cells" :key="cell">{{ cellName(cell) }}: {{ hint.candidates[cell]?.join(', ') }}</li></ul></details>
    </template>
  </section>
</template>

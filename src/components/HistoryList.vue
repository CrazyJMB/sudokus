<script setup lang="ts">
import { computed } from 'vue'
import { Check, Clock3, Flame } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useSudokuStore } from '@/stores/sudoku'
import { formatDate } from '@/lib/dates'
import { DIFFICULTY_LABELS } from '@/lib/sudoku'
import type { SavedGame } from '@/lib/history'
const store = useSudokuStore()
const emit = defineEmits<{ choose: [game: SavedGame] }>()
const games = computed(() => Object.values(store.games).sort((a, b) => b.date.localeCompare(a.date) || a.difficulty.localeCompare(b.difficulty)))
</script>

<template>
  <div v-if="games.length" class="history-list">
    <Button v-for="game in games" :key="`${game.date}:${game.difficulty}`" variant="ghost" class="history-item" :disabled="store.loading" @click="emit('choose', game)">
      <span class="history-item-icon" :class="{ complete: game.completedAt }"><Check v-if="game.completedAt" :size="18" /><Clock3 v-else :size="18" /></span>
      <span class="history-item-text"><strong>{{ formatDate(game.date, { day: 'numeric', month: 'long' }) }}</strong><span>{{ game.completedAt ? 'Completado' : 'En curso' }} · {{ game.date.slice(0, 4) }}<Flame v-if="game.completedAt && game.completedOn === game.date" :size="13" aria-label="Cuenta en la racha" /></span></span>
      <Badge variant="outline">{{ DIFFICULTY_LABELS[game.difficulty] }}</Badge>
    </Button>
  </div>
  <p v-else class="empty-history">Tu historial empieza con tu primer sudoku.</p>
</template>

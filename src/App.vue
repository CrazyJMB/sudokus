<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { CalendarDays, Check, CircleHelp, Flame, Grid3X3, LoaderCircle, Settings2, ShieldCheck, Trophy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import SudokuBoard from '@/components/SudokuBoard.vue'
import DigitPad from '@/components/DigitPad.vue'
import HistoryCalendar from '@/components/HistoryCalendar.vue'
import HistoryList from '@/components/HistoryList.vue'
import SettingsPanel from '@/components/SettingsPanel.vue'
import { useSudokuStore } from '@/stores/sudoku'
import { formatDate, type DateKey } from '@/lib/dates'
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '@/lib/sudoku'
import type { SavedGame } from '@/lib/history'

const store = useSudokuStore()
const historyOpen = ref(false)
const settingsOpen = ref(typeof window !== 'undefined' && window.location.hash === '#configuracion')
const boardRef = ref<InstanceType<typeof SudokuBoard> | null>(null)
const dateLabel = computed(() => formatDate(store.selectedDate, { weekday: 'long', day: 'numeric', month: 'long' }))
const solvedToday = computed(() => Object.values(store.games).some(g => g.date === store.today && g.completedAt && g.completedOn === g.date))
const earnedStreak = computed(() => store.currentGame?.completedOn === store.currentGame?.date)
const techniques = { easy: 'Candidatos únicos y únicos ocultos.', medium: 'Añade pares y candidatos bloqueados.', hard: 'Requiere técnicas más avanzadas.' }
let clock: ReturnType<typeof setInterval> | undefined
function returnToGame() {
  settingsOpen.value = false
  if (typeof window !== 'undefined' && window.location.hash === '#configuracion') window.location.hash = ''
}
function openSettings() { settingsOpen.value = true; window.location.hash = 'configuracion' }
function syncView() { settingsOpen.value = window.location.hash === '#configuracion' }
function openDate(date: DateKey) { historyOpen.value = false; returnToGame(); void store.openGame(date, store.difficulty) }
function openSaved(game: SavedGame) { historyOpen.value = false; returnToGame(); void store.openGame(game.date, game.difficulty) }
function changeDifficulty(value: unknown) {
  if (DIFFICULTIES.includes(value as Difficulty)) void store.openGame(store.selectedDate, value as Difficulty)
}
onMounted(() => {
  void store.openGame(store.today, store.preferredDifficulty)
  clock = setInterval(() => store.refreshToday(), 15_000)
  document.addEventListener('visibilitychange', refreshClock)
  window.addEventListener('hashchange', syncView)
})
function refreshClock() { store.refreshToday() }
onUnmounted(() => { clearInterval(clock); document.removeEventListener('visibilitychange', refreshClock); window.removeEventListener('hashchange', syncView) })
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a href="./" class="brand" aria-label="Sudoku diario, inicio"><span class="brand-mark"><Grid3X3 :size="24" :stroke-width="1.7" /></span><span>sudoku<span class="brand-light"> diario</span><span class="brand-dot">.</span></span></a>
      <div class="header-actions">
        <Badge class="daily-badge" variant="outline"><span class="badge-dot"></span>Uno cada día</Badge>
        <Button variant="ghost" class="history-trigger" aria-label="Historial" @click="historyOpen = true"><CalendarDays :size="17" /><span>Historial</span></Button>
        <Button variant="ghost" size="icon" aria-label="Configuración" title="Configuración" :aria-pressed="settingsOpen" @click="openSettings"><Settings2 :size="19" /></Button>
        <Dialog>
          <DialogTrigger as-child><Button variant="ghost" size="icon" aria-label="Cómo funcionan el sudoku y las rachas"><CircleHelp :size="19" /></Button></DialogTrigger>
          <DialogContent class="app-dialog help-dialog"><DialogHeader><DialogTitle>Un sudoku, cada día</DialogTitle><DialogDescription>Tu ritmo. Tu dificultad. Tu pequeña pausa.</DialogDescription></DialogHeader>
            <div class="help-copy"><p>Cada fecha tiene un sudoku distinto en cada dificultad. Siempre puedes volver a él y continuar donde lo dejaste.</p><p><strong>La racha cuenta días, no tableros.</strong> Completa al menos una dificultad del sudoku de hoy. Resolver dos niveles el mismo día suma un único día.</p><p>Los sudokus antiguos quedan en el historial, pero no suman ni reparan la racha. Puedes completar el de hoy hasta la medianoche de tu dispositivo.</p><p>Una racha de ayer sigue activa mientras hoy esté pendiente. Si dejas pasar un día entero, vuelve a cero.</p><p><strong>Controles:</strong> elige una casilla y un número. Usa las flechas para moverte, 1–9 para escribir, N para notas y Supr para borrar. Las ayudas están desactivadas por defecto; puedes activarlas en Configuración.</p><p>El progreso se guarda automáticamente en este navegador. Desde Configuración puedes exportarlo e importarlo para cambiar de dispositivo.</p></div>
          </DialogContent>
        </Dialog>
      </div>
    </header>

    <SettingsPanel v-if="settingsOpen" @close="returnToGame" />
    <main v-show="!settingsOpen" class="workspace">
      <section class="game-section" aria-label="Tu sudoku">
        <div class="game-heading">
          <div><p class="eyebrow">{{ store.isHistorical ? 'Del archivo' : 'Tu reto de hoy' }}</p><h1>{{ store.isHistorical ? 'Sudoku del archivo' : 'Sudoku del día' }}</h1><p class="game-date">{{ dateLabel }} <span>{{ store.selectedDate.slice(0, 4) }}</span></p></div>
          <div class="difficulty-control"><label for="difficulty">Dificultad</label><Select :model-value="store.difficulty" :disabled="store.loading" @update:model-value="changeDifficulty"><SelectTrigger id="difficulty" class="difficulty-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="level in DIFFICULTIES" :key="level" :value="level">{{ DIFFICULTY_LABELS[level] }}</SelectItem></SelectContent></Select></div>
        </div>

        <div v-if="store.isHistorical" class="archive-banner"><CalendarDays :size="16" /><span>Este sudoku cuenta en tu historial. La racha se gana con el de hoy.</span><Button variant="ghost" size="sm" @click="openDate(store.today)">Ir a hoy</Button></div>
        <div v-if="store.storageError" class="storage-alert" role="alert">{{ store.storageError }}</div>

        <div class="game-card">
          <div class="board-meta"><span><span class="puzzle-indicator"></span>{{ DIFFICULTY_LABELS[store.difficulty] }}<template v-if="store.preferences.showRemainingCounts && store.puzzle"><span class="meta-separator">/</span>{{ store.puzzle.clues }} números iniciales</template></span><span class="board-status">{{ store.currentGame?.completedAt ? 'Completado' : 'En curso' }}</span></div>
          <div v-if="store.loading" class="board-placeholder" role="status"><LoaderCircle class="loading-icon" :size="28" /><span>Preparando tu sudoku…</span></div>
          <div v-else-if="store.error" class="board-placeholder" role="alert"><p>{{ store.error }}</p><Button @click="openDate(store.selectedDate)">Volver a intentar</Button></div>
          <SudokuBoard v-else-if="store.puzzle" ref="boardRef" />
          <div v-if="store.currentGame?.completedAt" class="completion-banner" role="status"><span class="completion-icon"><Check :size="21" /></span><div><strong>¡Sudoku resuelto!</strong><p>{{ earnedStreak ? `Tu racha: ${store.stats.current} ${store.stats.current === 1 ? 'día' : 'días'}. Bien hecho.` : 'Uno más en tu historial. Tu racha sigue igual.' }}</p></div></div>
          <template v-else><DigitPad @entered="boardRef?.focusSelected()" /><div v-if="store.preferences.showProgress" class="progress-row"><Progress :model-value="store.progress" class="game-progress" aria-label="Casillas rellenadas" /><span>{{ store.progress }} % rellenado</span></div></template>
        </div>
        <div class="game-bottom"><p id="board-help">Selecciona una casilla y escribe un número.<br class="mobile-break" /><span> N para notas · Supr para borrar</span></p><span class="saved-indicator"><ShieldCheck :size="15" />{{ store.storageError ? 'Guardado no disponible' : 'Guardado automático' }}</span></div>
        <p class="difficulty-note">{{ techniques[store.difficulty] }}</p>
      </section>

      <aside class="history-sidebar" aria-label="Racha e historial">
        <div class="streak-card"><div class="streak-title"><Flame :size="20" /><span>Tu racha</span><Badge v-if="solvedToday" variant="outline" class="today-done">Hoy ✓</Badge></div><div class="streak-number">{{ store.stats.current }}<span>{{ store.stats.current === 1 ? 'día seguido' : 'días seguidos' }}</span></div><p>{{ solvedToday ? 'El reto de hoy ya está hecho.' : store.stats.current > 0 ? 'Completa el de hoy para seguir.' : 'El de hoy puede ser el primero.' }}</p><div class="stats-row"><div><span><Trophy :size="14" />Mejor racha</span><strong>{{ store.stats.best }} días</strong></div><div><span><Check :size="14" />Resueltos</span><strong>{{ store.stats.total }}</strong></div></div></div>
        <div class="calendar-card"><div class="section-heading"><h2>Tu calendario</h2><CalendarDays :size="17" /></div><HistoryCalendar @choose="openDate" /><div class="calendar-footer"><p>¿Te saltaste un día?<br />Recupéralo a tu ritmo.</p><Button v-if="store.isHistorical" variant="outline" size="sm" @click="openDate(store.today)">Hoy</Button></div></div>
        <p class="history-footnote">Los sudokus anteriores no cambian la racha.</p>
      </aside>
    </main>

    <footer class="site-footer"><span>Un día. Un tablero. A tu ritmo.</span><span>Tu progreso vive en este navegador.</span></footer>

    <Dialog v-model:open="historyOpen"><DialogContent class="app-dialog history-dialog"><DialogHeader><DialogTitle>Tu historial</DialogTitle><DialogDescription>{{ store.stats.total }} sudokus resueltos en {{ store.stats.days }} días distintos.</DialogDescription></DialogHeader><Tabs default-value="calendar"><TabsList class="history-tabs"><TabsTrigger value="calendar">Calendario</TabsTrigger><TabsTrigger value="activity">Partidas</TabsTrigger></TabsList><TabsContent value="calendar"><HistoryCalendar @choose="openDate" /></TabsContent><TabsContent value="activity"><HistoryList @choose="openSaved" /></TabsContent></Tabs><p class="history-footnote">Completar un sudoku anterior no suma días a tu racha.</p></DialogContent></Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { Check, ChevronLeft, Download, LoaderCircle, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { applyBackup, useSudokuStore } from '@/stores/sudoku'
import { AID_OPTIONS, MAX_BACKUP_BYTES, mergeGames, serializeBackup, type ProgressBackup } from '@/lib/persistence'
import { prepareBackup } from '@/lib/backup-async'
import { DIFFICULTIES, DIFFICULTY_LABELS, type Difficulty } from '@/lib/sudoku'
import type { SavedGame } from '@/lib/history'

const store = useSudokuStore()
defineEmits<{ close: [] }>()
const heading = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pending = shallowRef<ProgressBackup | null>(null)
const fileName = ref('')
const checking = ref(false)
const checkProgress = ref('')
const problem = ref('')
const status = ref('')
let selection = 0
const importedCompleted = computed(() => pending.value ? Object.values(pending.value.data.games).filter(g => g.completedAt).length : 0)
const preview = computed(() => pending.value ? mergeGames(JSON.parse(JSON.stringify(store.games)) as Record<string, SavedGame>, pending.value.data.games) : null)

function setDifficulty(value: unknown) {
  if (DIFFICULTIES.includes(value as Difficulty)) store.preferences.defaultDifficulty = value as Difficulty
}
function exportProgress() {
  problem.value = ''; status.value = ''
  const url = URL.createObjectURL(new Blob([serializeBackup(store.durableState())], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url; link.download = `sudoku-diario-progreso-${store.today}.json`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  status.value = 'Exportación preparada. Lleva este archivo al otro dispositivo e impórtalo aquí.'
}
async function chooseFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  const currentSelection = ++selection
  pending.value = null; fileName.value = ''; problem.value = ''; status.value = ''; checking.value = true
  checkProgress.value = 'Comprobando archivo…'
  try {
    if (file.size > MAX_BACKUP_BYTES) throw new Error('El archivo supera el límite de 10 MB.')
    const result = await prepareBackup(await file.text(), (done, total) => {
      if (selection === currentSelection) checkProgress.value = `Comprobando partidas: ${done} de ${total}`
    })
    if (selection !== currentSelection) return
    pending.value = result; fileName.value = file.name
  } catch (error) {
    if (selection === currentSelection) problem.value = error instanceof Error ? error.message : 'No se pudo leer el archivo.'
  } finally { if (selection === currentSelection) checking.value = false }
}
function importProgress() {
  if (!pending.value) return
  problem.value = ''; status.value = ''
  try {
    const result = applyBackup(store, pending.value)
    pending.value = null; fileName.value = ''
    status.value = `Progreso importado: ${result.added} partidas nuevas, ${result.updated} actualizadas y ${result.kept} completadas conservadas. También se han restaurado tus preferencias.`
  } catch (error) { problem.value = error instanceof Error ? error.message : 'No se pudo importar el progreso.' }
}
onMounted(() => heading.value?.focus({ preventScroll: true }))
onUnmounted(() => { selection++ })
</script>

<template>
  <main class="settings-page">
    <Button variant="ghost" class="settings-back" @click="$emit('close')"><ChevronLeft :size="17" />Volver al sudoku</Button>
    <div class="settings-heading"><p class="eyebrow">A tu manera</p><h1 ref="heading" tabindex="-1">Configuración</h1><p>Las preferencias se guardan al instante en este navegador.</p></div>
    <div v-if="store.storageError" class="storage-alert" role="alert">{{ store.storageError }}</div>

    <section class="settings-card" aria-labelledby="game-preferences-title">
      <h2 id="game-preferences-title">Preferencias de juego</h2>
      <div class="settings-difficulty"><div><label for="default-difficulty">Dificultad predeterminada</label><p>El nivel que se abre al entrar en la web.</p></div><Select :model-value="store.preferences.defaultDifficulty" @update:model-value="setDifficulty"><SelectTrigger id="default-difficulty" class="difficulty-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem v-for="level in DIFFICULTIES" :key="level" :value="level">{{ DIFFICULTY_LABELS[level] }}</SelectItem></SelectContent></Select></div>
    </section>

    <section class="settings-card" aria-labelledby="aids-title">
      <h2 id="aids-title">Ayudas opcionales</h2><p class="settings-section-copy">Todas vienen desactivadas para jugar como en papel. Activa solo las que quieras.</p>
      <div v-for="option in AID_OPTIONS" :key="option.key" class="setting-row"><div><label :for="`aid-${option.key}`">{{ option.label }}</label><p :id="`description-${option.key}`">{{ option.description }}</p></div><Switch :id="`aid-${option.key}`" v-model="store.preferences[option.key]" class="setting-switch" :aria-describedby="`description-${option.key}`" /></div>
    </section>

    <section class="settings-card" aria-labelledby="transfer-title">
      <h2 id="transfer-title">Lleva tu progreso contigo</h2><p class="settings-section-copy">Exporta tus partidas, notas, historial y preferencias. Importa el archivo en el otro dispositivo para continuar.</p>
      <div class="transfer-actions"><Button variant="outline" class="transfer-button" @click="exportProgress"><Download :size="17" />Exportar progreso</Button><Button variant="outline" class="transfer-button" :disabled="checking" @click="fileInput?.click()"><LoaderCircle v-if="checking" :size="17" class="loading-icon" /><Upload v-else :size="17" />Elegir archivo</Button><input ref="fileInput" type="file" accept=".json,application/json" class="sr-only" tabindex="-1" aria-label="Elegir una exportación de progreso" :disabled="checking" @change="chooseFile" /></div>
      <p class="transfer-detail">Archivo JSON · Máximo 10 MB. Las rachas conservan las fechas originales.</p>
      <p v-if="checking" role="status" class="transfer-status">{{ checkProgress }}</p>
      <div v-if="pending && preview" class="import-preview"><div class="import-preview-heading"><Check :size="19" /><strong>Archivo comprobado</strong></div><p class="import-filename">{{ fileName }}</p><p>{{ Object.keys(pending.data.games).length }} partidas · {{ importedCompleted }} completadas</p><p>{{ preview.added }} nuevas · {{ preview.updated }} se actualizarán · {{ preview.kept }} completadas se conservarán</p><p class="import-explanation">Se combina con este navegador. Si una partida está en curso en ambos, se usa la del archivo. También se restauran las preferencias del archivo.</p><Button class="import-button" @click="importProgress"><Upload :size="17" />Importar progreso</Button></div>
      <p v-if="problem" class="transfer-error" role="alert">{{ problem }}</p>
      <p v-if="status" class="transfer-success" role="status">{{ status }}</p>
    </section>
  </main>
</template>

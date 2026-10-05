<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Check } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { useSudokuStore } from '@/stores/sudoku'
import { addDays, dateKeyUTC, formatDate, isDateKey, parseDateKey, type DateKey } from '@/domain/dates'
import { dayStatus } from '@/domain/history'

const store = useSudokuStore()
const emit = defineEmits<{ choose: [date: DateKey] }>()
const month = ref(store.selectedDate.slice(0, 7))
watch(() => store.selectedDate, date => { month.value = date.slice(0, 7) })
const monthFirst = computed(() => `${month.value}-01`)
const monthLabel = computed(() => formatDate(monthFirst.value, { month: 'long', year: 'numeric' }))
const days = computed(() => {
  const first = parseDateKey(monthFirst.value)
  const offset = (first.getUTCDay() + 6) % 7
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(monthFirst.value, i - offset)
    return { date, valid: isDateKey(date), day: Number(date.slice(8)), ownMonth: date.slice(0, 7) === month.value, future: date > store.today || !isDateKey(date), status: dayStatus(Object.values(store.games), date) }
  })
})
function changeMonth(amount: number) {
  const date = parseDateKey(monthFirst.value)
  date.setUTCMonth(date.getUTCMonth() + amount)
  const target = dateKeyUTC(date).slice(0, 7)
  if (isDateKey(`${target}-01`) && target <= store.today.slice(0, 7)) month.value = target
}
</script>

<template>
  <div class="history-calendar">
    <div class="calendar-heading">
      <span>{{ monthLabel }}</span>
      <div class="calendar-navigation">
        <Button variant="ghost" size="icon" aria-label="Mes anterior" :disabled="month === '0001-01'" @click="changeMonth(-1)"><ChevronLeft :size="16" /></Button>
        <Button variant="ghost" size="icon" aria-label="Mes siguiente" :disabled="month >= store.today.slice(0, 7)" @click="changeMonth(1)"><ChevronRight :size="16" /></Button>
      </div>
    </div>
    <div class="calendar-weekdays" aria-hidden="true"><span v-for="(day, index) in ['L', 'M', 'X', 'J', 'V', 'S', 'D']" :key="index">{{ day }}</span></div>
    <div class="calendar-days" aria-label="Elige el día de tu sudoku">
      <Button v-for="day in days" :key="day.date" variant="ghost" class="calendar-day" :class="{ 'day-other': !day.ownMonth, 'day-today': day.date === store.today, 'day-selected': day.date === store.selectedDate, 'day-completed': day.status === 'completed', 'day-progress': day.status === 'progress' }" :disabled="day.future || store.loading" :aria-pressed="day.date === store.selectedDate" :aria-label="day.valid ? `${formatDate(day.date)}${day.date === store.today ? ', hoy' : ''}, ${day.status === 'completed' ? 'completado' : day.status === 'progress' ? 'en curso' : 'sin empezar'}` : 'Fecha no disponible'" @click="emit('choose', day.date)">
        <span>{{ day.valid ? day.day : '' }}</span><Check v-if="day.status === 'completed'" class="calendar-check" :size="10" aria-hidden="true" />
      </Button>
    </div>
    <div class="calendar-legend"><span><i class="legend-done"></i>Completado</span><span><i class="legend-progress"></i>En curso</span></div>
    <label class="date-jump">Ir a una fecha<input type="date" :value="store.selectedDate" :max="store.today" :disabled="store.loading" @change="emit('choose', ($event.target as HTMLInputElement).value)" /></label>
  </div>
</template>

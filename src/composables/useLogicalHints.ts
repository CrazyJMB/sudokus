import { computed, ref, watch, type Ref } from 'vue'
import { getLogicalHint, type LogicalHint } from '@/domain/sudoku/hints'
import type { Grid } from '@/domain/sudoku'

export function useLogicalHints(values: Readonly<Ref<Grid | undefined>>) {
  const hint = ref<LogicalHint | null>(null)
  const highlightedCells = computed(() => hint.value?.cells ?? [])
  function clearHint() { hint.value = null }
  function requestHint() { hint.value = values.value ? getLogicalHint(values.value) : null }
  watch(() => values.value?.join(','), clearHint, { flush: 'sync' })
  return { hint, highlightedCells, requestHint, clearHint }
}

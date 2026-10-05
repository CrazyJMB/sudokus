import { computed, ref, watch, type Ref } from 'vue'
import { getLogicalHint, type LogicalHint } from '@/domain/sudoku/hints'
import type { Grid } from '@/domain/sudoku'

export function useLogicalHints(values: Readonly<Ref<Grid | undefined>>) {
  const hint = ref<LogicalHint | null>(null)
  const hintLevel = ref(0)
  const highlightedCells = computed(() => {
    if (!hint.value) return []
    if (!hint.value.guidance || hintLevel.value === 2) return hint.value.cells
    return hintLevel.value === 0 ? hint.value.guidance.cells : hint.value.guidance.nudgeCells
  })
  function clearHint() { hint.value = null; hintLevel.value = 0 }
  function requestHint() { clearHint(); hint.value = values.value ? getLogicalHint(values.value) : null }
  function moreHint() { if (hint.value?.guidance) hintLevel.value = Math.min(2, hintLevel.value + 1) }
  watch(() => values.value?.join(','), clearHint, { flush: 'sync' })
  return { hint, hintLevel, highlightedCells, requestHint, clearHint, moreHint }
}

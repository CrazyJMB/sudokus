import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { generateSudoku } from '../src/domain/sudoku'
import { DEFAULT_PREFERENCES, type DurableState } from '../src/domain/storage'

const storageKey = 'sudoku-diario:v1:state'
const today = '2026-10-06'

test.use({ timezoneId: 'Atlantic/Canary' })
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(`${today}T10:00:00Z`))
})

async function savedState(page: Page): Promise<DurableState> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storageKey)
}

test('edita el diario con teclado, protege las pistas y recupera números y notas al recargar', async ({ page }) => {
  await page.goto('/')
  const board = page.getByRole('grid', { name: 'Sudoku de 9 filas y 9 columnas' })
  await expect(board.getByRole('gridcell')).toHaveCount(81)
  expect((await savedState(page)).preferences).toEqual(DEFAULT_PREFERENCES)
  const given = board.locator('[data-given="true"]').first()
  const original = await given.textContent()
  await given.click()
  await given.press('1')
  await given.press('Delete')
  await expect(given).toHaveText(original!)

  const editable = board.locator('[data-given="false"]')
  const valueCell = editable.nth(0)
  const noteCell = editable.nth(1)
  await valueCell.click()
  await valueCell.press('4')
  await expect(valueCell.locator('.cell-number')).toHaveText('4')
  await valueCell.press('Delete')
  await expect(valueCell.locator('.cell-number')).toHaveCount(0)
  await valueCell.press('Control+z')
  await expect(valueCell.locator('.cell-number')).toHaveText('4')
  await noteCell.click()
  await noteCell.press('n')
  await page.getByRole('button', { name: 'Alternar nota 7', exact: true }).click()
  await expect(noteCell).toHaveAttribute('aria-label', /notas 7/)
  const before = await savedState(page)
  await page.reload()
  await expect(valueCell.locator('.cell-number')).toHaveText('4')
  await expect(noteCell).toHaveAttribute('aria-label', /notas 7/)
  expect((await savedState(page)).games).toEqual(before.games)
  await expect(page.getByRole('button', { name: 'Deshacer', exact: true })).toBeDisabled()
})

test('completa el diario, acredita la racha y conserva la victoria al recargar', async ({ page }) => {
  const puzzle = generateSudoku(today, 'hard')
  await page.goto('/')
  await expect(page.locator('.workspace [role="gridcell"]')).toHaveCount(81)
  for (let i = 0; i < 81; i++) {
    if (puzzle.givens[i]) continue
    const cell = page.locator(`.workspace [data-cell="${i}"]`)
    await cell.click()
    await cell.press(String(puzzle.solution[i]))
  }
  await expect(page.getByText('¡Sudoku resuelto!', { exact: true })).toBeVisible()
  await expect(page.locator('.completion-banner')).toContainText('Tu racha: 1 día')
  expect((await savedState(page)).games[puzzle.id]!.completedOn).toBe(today)
  await page.reload()
  await expect(page.getByText('¡Sudoku resuelto!', { exact: true })).toBeVisible()
  await expect(page.locator('.workspace [aria-readonly="true"]')).toHaveCount(81)
  const cell = page.locator('.workspace [data-given="false"]').first()
  const original = await cell.textContent()
  await cell.click()
  await cell.press('Delete')
  await expect(cell).toHaveText(original!)
})

test('exporta un archivo real e importa notas y preferencias en otro navegador', async ({ page, browser }) => {
  await page.goto('/')
  const cell = page.locator('.workspace [data-given="false"]').first()
  await cell.click()
  await cell.press('n')
  await cell.press('6')
  await page.getByRole('button', { name: 'Configuración', exact: true }).click()
  await page.getByRole('switch', { name: 'Mostrar porcentaje rellenado', exact: true }).click()
  const source = await savedState(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar progreso', exact: true }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(`sudoku-diario-progreso-${today}.json`)
  const buffer = await readFile((await download.path())!)
  expect(JSON.parse(buffer.toString()).data).toEqual(source)

  const context = await browser.newContext({ timezoneId: 'Atlantic/Canary' })
  try {
    const target = await context.newPage()
    await target.clock.setFixedTime(new Date(`${today}T10:00:00Z`))
    await target.goto(new URL('/#configuracion', page.url()).href)
    await target.getByLabel('Elegir una exportación de progreso').setInputFiles({ name: download.suggestedFilename(), mimeType: 'application/json', buffer })
    await expect(target.getByText('Archivo comprobado', { exact: true })).toBeVisible()
    await target.getByRole('button', { name: 'Importar progreso', exact: true }).click()
    await expect(target.getByRole('status')).toContainText('Progreso importado')
    expect(await savedState(target)).toEqual(source)
    await target.getByRole('button', { name: 'Volver al sudoku', exact: true }).click()
    await expect(target.locator('.workspace [data-given="false"]').first()).toHaveAttribute('aria-label', /notas 6/)
    await expect(target.getByRole('progressbar')).toBeVisible()
    await target.reload()
    await expect(target.locator('.workspace [data-given="false"]').first()).toHaveAttribute('aria-label', /notas 6/)
    expect(await savedState(target)).toEqual(source)
  } finally {
    await context.close()
  }
})

test('un guardado corrupto permite jugar sin sobrescribir los datos originales', async ({ page }) => {
  const corrupt = '{guardado incompleto'
  await page.addInitScript(({ key, value }) => {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value)
  }, { key: storageKey, value: corrupt })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('No se pudo leer el guardado')
  const cell = page.locator('.workspace [data-given="false"]').first()
  await cell.click()
  await cell.press('3')
  await expect(cell.locator('.cell-number')).toHaveText('3')
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(corrupt)
  await page.reload()
  await expect(page.getByRole('alert')).toContainText('No se pudo leer el guardado')
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe(corrupt)
})

test('separa el progreso por fecha y nivel y mantiene el diario dentro del ancho móvil', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await page.goto('/')
  const cell = page.locator('.workspace [data-given="false"]').first()
  await cell.click()
  await cell.press('8')
  const original = await savedState(page)
  await page.getByRole('combobox', { name: 'Dificultad', exact: true }).click()
  await page.getByRole('option', { name: 'Fácil', exact: true }).click()
  await expect(page.locator('.board-meta')).toContainText('Fácil')
  await expect(page.locator('.workspace [role="gridcell"]')).toHaveCount(81)
  expect((await savedState(page)).preferences.defaultDifficulty).toBe('hard')
  await page.getByRole('button', { name: 'Historial', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('button', { name: 'Mes siguiente', exact: true })).toBeDisabled()
  await dialog.getByLabel('Ir a una fecha').fill('2026-10-05')
  await expect(page.getByRole('heading', { name: 'Sudoku del archivo', exact: true })).toBeVisible()
  await expect(page.locator('.workspace [role="gridcell"]')).toHaveCount(81)
  const state = await savedState(page)
  expect(Object.keys(state.games)).toHaveLength(3)
  const id = Object.keys(original.games)[0]!
  expect(state.games[id]).toEqual(original.games[id])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Sudoku del día', exact: true })).toBeVisible()
  await expect(cell.locator('.cell-number')).toHaveText('8')
})

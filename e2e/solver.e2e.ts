import { expect, test, type Page } from '@playwright/test'

const solved = '534678912672195348198342567859761423426853791713924856961537284287419635345286179'.split('').map(Number)
const printed = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'.split('').map(Number)

async function seedExternal(page: Page, values: number[]) {
  await page.addInitScript(values => {
    if (!localStorage.getItem('sudoku-diario:external:v1')) localStorage.setItem('sudoku-diario:external:v1', JSON.stringify({ schema: 1, values, uncertain: [], needsReview: false }))
  }, values)
}

async function uploadPrintedSudoku(page: Page) {
  const data = await page.evaluate(values => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 800
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 800, 800)
    ctx.strokeStyle = 'black'
    for (let i = 0; i <= 9; i++) {
      ctx.lineWidth = i % 3 === 0 ? 3 : 1
      ctx.beginPath(); ctx.moveTo(40 + i * 80, 40); ctx.lineTo(40 + i * 80, 760); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(40, 40 + i * 80); ctx.lineTo(760, 40 + i * 80); ctx.stroke()
    }
    ctx.fillStyle = 'black'; ctx.font = '48px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    values.forEach((n, i) => { if (n) ctx.fillText(String(n), 80 + (i % 9) * 80, 80 + Math.floor(i / 9) * 80) })
    return canvas.toDataURL('image/png').split(',')[1]!
  }, printed)
  await page.getByLabel('Elegir foto del sudoku', { exact: true }).setInputFiles({ name: 'sudoku.png', mimeType: 'image/png', buffer: Buffer.from(data, 'base64') })
  const stage = page.getByRole('button', { name: 'Marca la esquina superior izquierda del borde exterior del sudoku.' })
  await expect(stage).toBeVisible()
  const box = (await stage.boundingBox())!
  const photo = page.locator('.photo-stage[role="button"]')
  for (const [x, y] of [[.05, .05], [.95, .05], [.95, .95], [.05, .95]]) await photo.click({ position: { x: box.width * x!, y: box.height * y! } })
  await expect(page.getByAltText('Sudoku recortado y corregido para leer sus 81 casillas')).toBeVisible()
}

test('pide una explicación en el diario sin rellenar casillas ni cambiar preferencias', async ({ page }) => {
  await page.goto('/')
  const cells = page.locator('.workspace [role="gridcell"]')
  await expect(cells).toHaveCount(81)
  const before = await cells.allTextContents()
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Pista razonada' })).toBeVisible()
  expect(await cells.allTextContents()).toEqual(before)
  const editable = page.locator('.workspace [data-given="false"]').first()
  await editable.click(); await editable.press('1')
  await expect(page.getByRole('region', { name: 'Pista razonada' })).toHaveCount(0)
})

test('edita un tablero externo, explica el siguiente número y conserva el estado', async ({ page }) => {
  const values = [...solved]; values[0] = 0
  await seedExternal(page, values)
  await page.goto('/#resolver')
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Pista razonada' })).not.toContainText('solo puede ir el 5')
  await page.getByRole('button', { name: 'Otra pista', exact: true }).click()
  await page.getByRole('button', { name: 'Ver la respuesta', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'En F1 C1 solo puede ir el 5.' })).toBeVisible()
  const first = page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true })
  await expect(first).toHaveValue('')
  await first.click(); await first.press('5')
  await expect(page.getByRole('region', { name: 'Pista razonada' })).toHaveCount(0)
  await page.reload(); await expect(first).toHaveValue('5')
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'El tablero está completo' })).toBeVisible()
  await first.fill('3')
  await expect(first).toHaveAttribute('aria-invalid', 'true')
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Hay números repetidos' })).toBeVisible()
  await page.getByRole('button', { name: 'Deshacer', exact: true }).click()
  await expect(first).toHaveValue('5')
})

test('la captura recibe una pista visual y solo revela la casilla al pedir la respuesta', async ({ page }) => {
  const values = ['900400500', '400930008', '007002000', '008043007', '243798615', '000000834', '000380102', '061200009', '000050000'].join('').split('').map(Number)
  await seedExternal(page, values)
  await page.goto('/#resolver')
  const panel = page.getByRole('region', { name: 'Pista razonada' })
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(panel).toContainText('Mira el bloque central. Busca dónde puede ir el 2.')
  await expect(panel).not.toContainText('F6 C5')
  await expect(page.locator('.external-board .cell-hint')).toHaveCount(9)
  await expect(panel.locator('.hint-steps')).toHaveCount(0)
  await page.getByRole('button', { name: 'Otra pista', exact: true }).click()
  await expect(panel).toContainText('columnas 4 y 6 ya hay un 2')
  await expect(panel).not.toContainText('F6 C5')
  await expect(page.locator('.external-board .cell-hint')).toHaveCount(11)
  await page.screenshot({ path: 'test-results/hint-guidance.png', fullPage: true })
  await page.getByRole('button', { name: 'Ver la respuesta', exact: true }).click()
  await expect(panel).toContainText('En F6 C5 solo puede ir el 2.')
  await expect(page.locator('.external-board .cell-hint')).toHaveCount(1)
  await expect(page.getByRole('gridcell', { name: 'Fila 6, columna 5', exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(panel).not.toContainText('F6 C5')
  await page.getByRole('gridcell', { name: 'Fila 6, columna 5', exact: true }).fill('2')
  await expect(panel).toHaveCount(0)
})

test('la página externa cabe en móvil y vuelve al diario con su navegación', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#resolver')
  await expect(page.getByRole('heading', { name: 'Tu sudoku, con ayuda' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true }).fill('7')
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await page.screenshot({ path: 'test-results/solver-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Volver al sudoku diario' }).click()
  await expect(page.getByRole('heading', { name: 'Sudoku del día', exact: true })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('heading', { name: 'Tu sudoku, con ayuda' })).toBeVisible()
  await expect(page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true })).toHaveValue('7')
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})

test('lee una foto con OCR real y exige revisión antes de pedir pistas', async ({ page }) => {
  const photoUploads: string[] = []
  page.on('request', request => { if (request.method() === 'POST') photoUploads.push(request.url()) })
  await page.goto('/#resolver')
  await uploadPrintedSudoku(page)
  await page.getByRole('button', { name: 'Leer números', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Usar lectura y revisar' })).toBeVisible({ timeout: 120_000 })
  await page.getByRole('button', { name: 'Usar lectura y revisar' }).click()
  const numbers = await page.locator('.external-board input').evaluateAll(inputs => inputs.map(input => Number((input as HTMLInputElement).value)))
  expect(numbers.filter((n, i) => printed[i] && n === printed[i]).length).toBeGreaterThanOrEqual(28)
  expect(numbers.filter((n, i) => !printed[i] && n)).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Pedir una pista', exact: true })).toBeDisabled()
  // Review/correct every cell, as a user can, even if OCR happened to read them all correctly.
  for (let i = 0; i < 81; i++) if (numbers[i] !== printed[i]) await page.locator(`.external-board [data-cell="${i}"]`).fill(printed[i] ? String(printed[i]) : '')
  await page.getByRole('button', { name: 'He revisado los números' }).click()
  await page.getByRole('button', { name: 'Pedir una pista', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Pista razonada' })).toBeVisible()
  expect(photoUploads).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('sudoku-diario:v1:state'))).toBeNull()
  await page.screenshot({ path: 'test-results/solver-ocr.png', fullPage: true })
})

test('informa de fallos al cargar el lector y conserva la edición manual', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort())
  await page.goto('/#resolver')
  await page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true }).fill('7')
  await uploadPrintedSudoku(page)
  await page.getByRole('button', { name: 'Leer números', exact: true }).click()
  await expect(page.locator('.photo-import [role="alert"]')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Leer números', exact: true })).toBeEnabled()
  await expect(page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true })).toHaveValue('7')
})

test('permite cancelar la lectura sin sustituir el tablero', async ({ page }) => {
  await page.goto('/#resolver')
  await page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true }).fill('7')
  await uploadPrintedSudoku(page)
  await page.getByRole('button', { name: 'Leer números', exact: true }).click()
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Lectura cancelada.' })).toBeVisible()
  await expect(page.getByRole('gridcell', { name: 'Fila 1, columna 1', exact: true })).toHaveValue('7')
  await expect(page.getByRole('button', { name: 'Usar lectura y revisar' })).toHaveCount(0)
})

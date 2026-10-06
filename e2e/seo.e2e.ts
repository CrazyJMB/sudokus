import { expect, test } from '@playwright/test'

const canonical = 'https://sudokus.crazyjmb.com/'

test.describe('SEO disponible sin ejecutar JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('entrega metadatos, autoría y contenido en el HTML inicial', async ({ page }) => {
    const response = await page.goto('/')
    expect(response!.status()).toBe(200)
    await expect(page).toHaveTitle('Sudoku diario gratis online | Crazyjmb')
    await expect(page.locator('html')).toHaveAttribute('lang', 'es')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical)
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /sudoku diario gratis.*Crazyjmb/)
    await expect(page.locator('meta[name="author"]')).toHaveAttribute('content', 'Crazyjmb')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index, follow/)
    await expect(page.getByRole('heading', { name: 'Un proyecto personal de Crazyjmb', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Cómo jugar al sudoku', exact: true })).toBeVisible()
    await expect(page.locator('footer a[rel="author"]')).toHaveAttribute('href', 'https://crazyjmb.com/')
    await expect(page.locator('noscript p')).toBeVisible()
    await expect(page.locator('noscript p')).toContainText('Activa JavaScript')

    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!)
    expect(data['@context']).toBe('https://schema.org')
    const graph = data['@graph'] as Array<{ '@type': string; '@id': string; name?: string; url?: string; creator?: { '@id': string } }>
    const author = graph.find(item => item['@type'] === 'Person')!
    expect(author).toMatchObject({ name: 'Crazyjmb', url: 'https://crazyjmb.com/' })
    for (const type of ['WebSite', 'WebApplication']) {
      expect(graph.find(item => item['@type'] === type)).toMatchObject({
        url: canonical, creator: { '@id': author['@id'] },
      })
    }
  })
})

test('sirve el sitemap, robots y la imagen social y conserva el SEO al navegar', async ({ page, request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.status()).toBe(200)
  const rules = await robots.text()
  expect(rules).toContain('User-agent: *')
  expect(rules).toContain('Allow: /')
  expect(rules).toContain(`Sitemap: ${canonical}sitemap.xml`)

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.status()).toBe(200)
  await page.goto('/')
  const locations = await page.evaluate(xml => {
    const document = new DOMParser().parseFromString(xml, 'application/xml')
    if (document.querySelector('parsererror')) throw new Error('Sitemap XML inválido')
    return [...document.getElementsByTagName('loc')].map(item => item.textContent)
  }, await sitemap.text())
  expect(locations).toEqual([canonical])

  const imageURL = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(imageURL).toBe(`${canonical}social-card.png`)
  await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute('content', imageURL!)
  const image = await request.get(new URL(imageURL!).pathname)
  expect(image.status()).toBe(200)
  expect(image.headers()['content-type']).toContain('image/png')
  const png = await image.body()
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630])

  await page.setViewportSize({ width: 320, height: 740 })
  await expect(page.locator('.workspace [role="gridcell"]')).toHaveCount(81)
  await expect(page.getByRole('heading', { name: 'Un proyecto personal de Crazyjmb', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('link', { name: 'introducir un sudoku de papel o de una foto', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Tu sudoku, con ayuda', exact: true })).toBeVisible()
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical)
  await page.getByRole('link', { name: 'Configuración', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Configuración', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

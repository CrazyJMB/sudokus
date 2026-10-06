// Regenerate the committed sharing image with: npm run seo:image
// Uses the project's existing Playwright dependency; no runtime dependency is added.
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const printed = '530070000600195000098000060800060003400803001700020006060000280000419005000080079'
const grid = Array.from({ length: 10 }, (_, i) => {
  const p = i * 40
  return `<path d="M${p} 0V360M0 ${p}H360" stroke="#${i % 3 === 0 ? '637183' : 'd0d7d3'}" stroke-width="${i % 3 === 0 ? 3 : 1}"/>`
}).join('')
const numbers = [...printed].map((n, i) => n === '0' ? '' : `<text x="${i % 9 * 40 + 20}" y="${Math.floor(i / 9) * 40 + 21}" text-anchor="middle" dominant-baseline="central">${n}</text>`).join('')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#10131a"/>
  <rect x="0" y="0" width="1200" height="8" fill="#b8f56a"/>
  <g font-family="Arial, sans-serif">
    <text x="72" y="104" fill="#b8f56a" font-size="18" font-weight="700" letter-spacing="3">TU PAUSA DE CADA DÍA</text>
    <text x="68" y="225" fill="#f2f4f7" font-size="76" font-weight="700" letter-spacing="-3">sudoku diario<tspan fill="#b8f56a">.</tspan></text>
    <text x="72" y="295" fill="#c3cbd7" font-size="28">Un día. Un tablero. A tu ritmo.</text>
    <text x="72" y="352" fill="#a0adbf" font-size="23">Gratis · Sin registro · Tres dificultades</text>
    <rect x="72" y="402" width="352" height="46" rx="23" fill="#b8f56a"/>
    <text x="248" y="432" text-anchor="middle" fill="#17220b" font-size="18" font-weight="700">Con pistas para aprender paso a paso</text>
    <path d="M72 496H1128" stroke="#303946"/>
    <text x="72" y="551" fill="#a0adbf" font-size="20">Un proyecto personal de <tspan fill="#b8f56a" font-weight="700">Crazyjmb</tspan></text>
    <text x="1128" y="551" text-anchor="end" fill="#c3cbd7" font-size="20">sudokus.crazyjmb.com</text>
  </g>
  <rect x="740" y="104" width="404" height="384" rx="18" fill="#1a202a" stroke="#303946"/>
  <g transform="translate(762 116)">
    <rect width="360" height="360" fill="#f8faf6"/>
    ${grid}
    <g font-family="Arial, sans-serif" font-size="25" fill="#293340">${numbers}</g>
  </g>
</svg>`

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.setContent(`<html><body style="margin:0">${svg}</body></html>`)
  await page.screenshot({ path: fileURLToPath(new URL('../public/social-card.png', import.meta.url)) })
} finally {
  await browser.close()
}

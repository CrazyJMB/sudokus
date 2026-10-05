import { describe, expect, it } from 'vitest'
import { inkThreshold, perspectiveMap, validCorners } from '../src/infrastructure/ocr/geometry'

describe('preparación de las fotos', () => {
  it('rechaza esquinas cruzadas, degeneradas y fuera de la imagen', () => {
    expect(validCorners([])).toBe(false)
    expect(validCorners([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 1 }])).toBe(false)
    expect(validCorners(Array(4).fill({ x: .5, y: .5 }))).toBe(false)
    expect(validCorners([{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toBe(false)
  })
  it('transforma un cuadrado sin distorsión y corrige una perspectiva trapezoidal', () => {
    const square = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]
    const identity = perspectiveMap(square)
    expect(identity(.2, .7)).toEqual({ x: .2, y: .7 })
    const corners = [{ x: .2, y: .1 }, { x: .8, y: .1 }, { x: 1, y: .9 }, { x: 0, y: .9 }]
    const map = perspectiveMap(corners)
    for (const [i, point] of square.entries()) {
      expect(map(point.x, point.y).x).toBeCloseTo(corners[i]!.x)
      expect(map(point.x, point.y).y).toBeCloseTo(corners[i]!.y)
    }
    expect(map(.5, .5).x).toBeCloseTo(.5)
    expect(map(.5, .5).y).toBeCloseTo(.4)
  })
  it('separa tinta de papel y evita convertir el papel blanco en tinta', () => {
    const threshold = inkThreshold(new Uint8Array([20, 20, 35, 40, 225, 240, 250, 255]))
    expect(threshold).toBeGreaterThanOrEqual(40); expect(threshold).toBeLessThan(225)
    expect(inkThreshold(new Uint8Array(64).fill(255))).toBeLessThan(255)
  })
})

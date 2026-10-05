export interface Point { x: number; y: number }

/** Corners in clockwise order: top-left, top-right, bottom-right, bottom-left. */
export function validCorners(points: Point[]): boolean {
  if (points.length !== 4 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) return false
  for (let i = 0; i < 4; i++) {
    const a = points[i]!, b = points[(i + 1) % 4]!, c = points[(i + 2) % 4]!
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 0.005) return false
  }
  return true
}

export function perspectiveMap(points: Point[]): (u: number, v: number) => Point {
  if (!validCorners(points)) throw new Error('Marca las cuatro esquinas del tablero en el orden indicado, sin cruzarlas.')
  const [p0, p1, p2, p3] = points as [Point, Point, Point, Point]
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y
  const det = dx1 * dy2 - dx2 * dy1
  const g = (dx3 * dy2 - dx2 * dy3) / det, h = (dx1 * dy3 - dx3 * dy1) / det
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y
  return (u, v) => ({ x: (a * u + b * v + p0.x) / (g * u + h * v + 1), y: (d * u + e * v + p0.y) / (g * u + h * v + 1) })
}

/** Otsu threshold, used per cell so uneven paper lighting does not affect the whole board. */
export function inkThreshold(grey: Uint8Array): number {
  const histogram = new Uint32Array(256)
  let sum = 0
  for (const value of grey) { histogram[value]++; sum += value }
  let weight = 0, partial = 0, best = -1, threshold = 0
  for (let t = 0; t < 256; t++) {
    weight += histogram[t]!
    if (!weight) continue
    const rest = grey.length - weight
    if (!rest) break
    partial += t * histogram[t]!
    const difference = partial / weight - (sum - partial) / rest
    const variance = weight * rest * difference * difference
    if (variance > best) { best = variance; threshold = t }
  }
  return Math.min(190, threshold)
}

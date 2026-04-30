/**
 * Pixel stars spawn in an outer band near the frame edges (outside the ring),
 * move in a straight line toward the center, and respawn at the edge when they arrive.
 */

export type Star = {
  x: number
  y: number
  kind: 0 | 1 | 2
}

const COLORS = ['#7aebff', '#ff7ecf', '#e8e2ff'] as const

function rnd(): number {
  return Math.random()
}

const VANISH_DIST = 3

/**
 * Spawn near a frame edge (outer band), staying outside a central keep-out disk
 * so stars read as "coming from outside the ring".
 */
export function edgeSpawn(w: number, h: number, cx: number, cy: number): { x: number; y: number } {
  const minDim = Math.min(w, h)
  /** Roughly the ring + margin in canvas space — no spawns inside this disk. */
  const keepOut = minDim * 0.38
  const bandLo = minDim * 0.04
  const bandHi = minDim * 0.26

  for (let i = 0; i < 32; i++) {
    const depth = bandLo + rnd() * (bandHi - bandLo)
    const edge = Math.floor(rnd() * 4)
    let x = 0
    let y = 0
    if (edge === 0) {
      x = rnd() * w
      y = rnd() * depth
    } else if (edge === 1) {
      x = rnd() * w
      y = h - rnd() * depth
    } else if (edge === 2) {
      x = rnd() * depth
      y = rnd() * h
    } else {
      x = w - rnd() * depth
      y = rnd() * h
    }
    if (Math.hypot(x - cx, y - cy) >= keepOut) return { x, y }
  }

  // Rare tiny layouts: tuck into a corner band.
  const m = 2
  return {
    x: rnd() < 0.5 ? m + rnd() * bandLo : w - m - rnd() * bandLo,
    y: rnd() < 0.5 ? m + rnd() * bandLo : h - m - rnd() * bandLo,
  }
}

export function createStars(count: number, w: number, h: number, cx: number, cy: number): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const p = edgeSpawn(w, h, cx, cy)
    stars.push({
      x: p.x,
      y: p.y,
      kind: (Math.floor(rnd() * 3) % 3) as 0 | 1 | 2,
    })
  }
  return stars
}

/** Move each star toward `(cx, cy)`; respawn when it reaches the center. */
export function stepStars(
  stars: Star[],
  w: number,
  h: number,
  cx: number,
  cy: number,
  dtSec: number,
  speedPxPerSec: number,
): void {
  const maxDiag = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 0.001

  for (const s of stars) {
    const dx = cx - s.x
    const dy = cy - s.y
    const dist = Math.hypot(dx, dy)

    if (dist < VANISH_DIST) {
      const p = edgeSpawn(w, h, cx, cy)
      s.x = p.x
      s.y = p.y
      continue
    }

    const nx = dx / dist
    const ny = dy / dist
    // Slightly faster when closer (subtle depth feel).
    const closeness = 1 - dist / maxDiag
    const stepMul = 0.55 + 0.45 * closeness
    let step = speedPxPerSec * dtSec * stepMul
    if (step > dist - VANISH_DIST * 0.5) step = Math.max(0, dist - VANISH_DIST * 0.5)

    s.x += nx * step
    s.y += ny * step
  }
}

export function drawStars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  stars: Star[],
  cx: number,
  cy: number,
  stress: number,
): void {
  const maxDiag = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 0.001
  ctx.save()
  ctx.imageSmoothingEnabled = false
  for (const s of stars) {
    const dist = Math.hypot(s.x - cx, s.y - cy)
    const closeness = 1 - Math.min(1, dist / maxDiag)
    const px = 1 + Math.floor(closeness * (3 + stress * 1.2))
    const a = 0.18 + (0.55 + stress * 0.38) * closeness
    ctx.globalAlpha = Math.min(1, a)
    const shift = Math.floor(stress * 2) % 3
    const kind = ((s.kind + shift) % 3) as 0 | 1 | 2
    ctx.fillStyle = COLORS[kind]
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), px, px)
  }
  ctx.restore()
}

export function attachStarfield(
  canvas: HTMLCanvasElement,
  opts?: { starCount?: number; speed?: number; getStress?: () => number },
): () => void {
  const starCount = opts?.starCount ?? 100
  const speedMul = opts?.speed ?? 0.52
  const getStress = opts?.getStress ?? (() => 0.25)
  /** Base drift speed in canvas pixels per second (buffer = CSS × DPR). */
  const speedBase = 95 + 220 * speedMul

  let stars: Star[] = []
  let lastW = 0
  let lastH = 0

  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return () => {}

  let raf = 0
  let last = performance.now()

  const resize = () => {
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const bw = Math.max(1, Math.floor(rect.width * dpr))
    const bh = Math.max(1, Math.floor(rect.height * dpr))
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
  }

  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    resize()
    const w = canvas.width
    const h = canvas.height
    const cx = w * 0.5
    const cy = h * 0.5

    if (w !== lastW || h !== lastH || stars.length !== starCount) {
      stars = createStars(starCount, w, h, cx, cy)
      lastW = w
      lastH = h
    }

    const stress = Math.max(0, Math.min(1, getStress()))
    const speedPxPerSec = speedBase * (0.48 + stress * 2.35)
    stepStars(stars, w, h, cx, cy, dt, speedPxPerSec)

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, w, h)
    drawStars(ctx, w, h, stars, cx, cy, stress)

    raf = requestAnimationFrame(loop)
  }

  raf = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(raf)
}

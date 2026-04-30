export type HitLabel = 'perfect' | 'good' | 'ok' | 'miss'

export type GradeResult = {
  label: HitLabel
  points: number
  comboAfter: number
  livesDelta: number
}

/** 0 = chill run start, 1 = max difficulty (combo + score). */
export function computeStress(combo: number, score: number): number {
  return Math.min(1, combo * 0.078 + score * 0.00058)
}

export type CycleWindows = {
  pulseMs: number
  graceMs: number
  perfectMs: number
  goodMs: number
  okMs: number
}

/** Timing for this pulse only — call at `beginCycle` from current combo/score. */
export function cycleWindows(combo: number, score: number): CycleWindows {
  const s = computeStress(combo, score)
  return {
    pulseMs: Math.round(2800 - s * 900),
    graceMs: Math.round(510 - s * 170),
    perfectMs: Math.round(92 - s * 40),
    goodMs: Math.round(205 - s * 58),
    okMs: Math.round(365 - s * 105),
  }
}

/** Extra score for chaining perfects (first perfect adds 0). */
export function perfectChainBonus(chainLength: number): number {
  if (chainLength <= 1) return 0
  return Math.min(280, (chainLength - 1) * 22)
}

/** Signed ms: negative = early, positive = late vs ideal lock moment. */
export function gradeDelta(deltaMs: number, combo: number, w: CycleWindows): GradeResult {
  const c = Math.min(10, Math.max(1, combo))
  const ad = Math.abs(deltaMs)

  if (ad <= w.perfectMs) {
    return { label: 'perfect', points: 100 * c, comboAfter: Math.min(10, c + 1), livesDelta: 0 }
  }
  if (ad <= w.goodMs) {
    return { label: 'good', points: 45 * c, comboAfter: Math.min(10, c + 1), livesDelta: 0 }
  }
  if (ad <= w.okMs) {
    return { label: 'ok', points: 20, comboAfter: 1, livesDelta: 0 }
  }
  return { label: 'miss', points: 0, comboAfter: 1, livesDelta: -1 }
}

/** When the player never presses before the pulse expires (+ grace). */
export function gradeTimeout(): GradeResult {
  return { label: 'miss', points: 0, comboAfter: 1, livesDelta: -1 }
}

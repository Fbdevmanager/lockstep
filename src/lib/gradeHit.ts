export type HitLabel = 'perfect' | 'good' | 'ok' | 'miss'

export type GradeResult = {
  label: HitLabel
  points: number
  comboAfter: number
  livesDelta: number
}

const PULSE_MS = 2000
const PERFECT_MS = 55
const GOOD_MS = 130
const OK_MS = 220
const GRACE_AFTER_MS = 280

export { PULSE_MS, GRACE_AFTER_MS }

/** Signed ms: negative = early, positive = late vs ideal lock moment. */
export function gradeDelta(deltaMs: number, combo: number): GradeResult {
  const c = Math.min(10, Math.max(1, combo))
  const ad = Math.abs(deltaMs)

  if (ad <= PERFECT_MS) {
    return { label: 'perfect', points: 100 * c, comboAfter: Math.min(10, c + 1), livesDelta: 0 }
  }
  if (ad <= GOOD_MS) {
    return { label: 'good', points: 45 * c, comboAfter: Math.min(10, c + 1), livesDelta: 0 }
  }
  if (ad <= OK_MS) {
    return { label: 'ok', points: 20, comboAfter: 1, livesDelta: 0 }
  }
  return { label: 'miss', points: 0, comboAfter: 1, livesDelta: -1 }
}

/** When the player never presses before the pulse expires (+ grace). */
export function gradeTimeout(): GradeResult {
  return { label: 'miss', points: 0, comboAfter: 1, livesDelta: -1 }
}

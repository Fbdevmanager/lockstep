const STORAGE_KEY = 'lockstep-best-score'

export function loadBestScore(): number {
  if (typeof localStorage === 'undefined') return 0
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return 0
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function saveBestScoreIfHigher(score: number): number {
  const prev = loadBestScore()
  if (score <= prev) return prev
  try {
    localStorage.setItem(STORAGE_KEY, String(score))
  } catch {
    /* quota / private mode */
  }
  return score
}

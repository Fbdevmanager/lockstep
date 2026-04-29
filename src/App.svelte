<script lang="ts">
  import { onMount } from 'svelte'
  import {
    PULSE_MS,
    GRACE_AFTER_MS,
    gradeDelta,
    gradeTimeout,
    type HitLabel,
  } from './lib/gradeHit'
  import { loadBestScore, saveBestScoreIfHigher } from './lib/scores'

  type Screen = 'title' | 'play' | 'over'

  let screen = $state<Screen>('title')
  let score = $state(0)
  let best = $state(0)
  let lives = $state(3)
  let combo = $state(1)

  let pulseStart = $state<number | null>(null)
  let cycleResolved = $state(true)
  let cooldownUntil = $state(0)

  /** 0–1+ for ring; >1 during grace window */
  let phase = $state(0)
  let feedback = $state<{ label: HitLabel; until: number } | null>(null)
  let shakeActive = $state(false)

  let rafId = 0

  function setFeedback(label: HitLabel, durationMs = 720) {
    feedback = { label, until: performance.now() + durationMs }
  }

  function triggerShake(ms = 420) {
    shakeActive = true
    setTimeout(() => {
      shakeActive = false
    }, ms)
  }

  function beginCycle() {
    pulseStart = performance.now()
    cycleResolved = false
    cooldownUntil = 0
  }

  function endGame() {
    screen = 'over'
    pulseStart = null
    cycleResolved = true
    cooldownUntil = 0
    feedback = null
    best = saveBestScoreIfHigher(score)
  }

  function applyGrade(label: HitLabel, points: number, nextCombo: number, livesDelta: number) {
    score += points
    combo = Math.min(10, Math.max(1, nextCombo))
    lives += livesDelta
    setFeedback(label)
    if (label === 'miss') triggerShake()
    if (lives <= 0) {
      endGame()
      return
    }
    cooldownUntil = performance.now() + 560
  }

  function tryHit() {
    if (screen !== 'play' || cycleResolved || pulseStart == null) return
    const elapsed = performance.now() - pulseStart
    const delta = elapsed - PULSE_MS
    const g = gradeDelta(delta, combo)
    cycleResolved = true
    applyGrade(g.label, g.points, g.comboAfter, g.livesDelta)
  }

  function tick(now: number) {
    if (feedback && now >= feedback.until) feedback = null

    if (screen !== 'play' || pulseStart == null) {
      rafId = requestAnimationFrame(tick)
      return
    }

    if (cooldownUntil > 0 && now >= cooldownUntil) {
      cooldownUntil = 0
      if (lives > 0 && screen === 'play') beginCycle()
    }

    if (!cycleResolved && pulseStart != null && cooldownUntil === 0) {
      const elapsed = now - pulseStart
      phase = elapsed / PULSE_MS
      if (elapsed > PULSE_MS + GRACE_AFTER_MS) {
        cycleResolved = true
        const g = gradeTimeout()
        applyGrade(g.label, g.points, g.comboAfter, g.livesDelta)
      }
    } else if (cooldownUntil > 0) {
      phase = 0
    }

    rafId = requestAnimationFrame(tick)
  }

  function startRun() {
    best = loadBestScore()
    screen = 'play'
    score = 0
    lives = 3
    combo = 1
    feedback = null
    beginCycle()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault()
      if (screen === 'title' || screen === 'over') startRun()
      else tryHit()
    }
  }

  function onPointerDown() {
    if (screen === 'title' || screen === 'over') startRun()
    else tryHit()
  }

  onMount(() => {
    best = loadBestScore()
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  })

  const ringScale = $derived(
    screen === 'play' && pulseStart != null && cooldownUntil === 0
      ? 1.58 - 0.58 * Math.min(1, phase)
      : 1.58,
  )

  const nearLock = $derived(phase >= 0.88 && phase <= 1.05 && screen === 'play')
</script>

<svelte:window onkeydown={onKeydown} />

<main class:shake={shakeActive} class="shell">
  <div class="halo" aria-hidden="true"></div>

  <header class="top">
    <h1>Lockstep</h1>
    <p class="tagline">Press Space when the rings meet.</p>
  </header>

  <section class="stage" aria-live="polite">
    <button
      type="button"
      class="ring-button"
      onclick={onPointerDown}
      aria-label="Play: tap or press Space when rings align"
    >
      <div class="ring-outer">
        <div
          class="ring-inner"
          class:glow={nearLock}
          style:transform="scale3d({ringScale}, {ringScale}, 1)"
        ></div>
      </div>
    </button>

    {#if feedback}
      <div class="toast" data-hit={feedback.label}>
        {#if feedback.label === 'perfect'}PERFECT{/if}
        {#if feedback.label === 'good'}GOOD{/if}
        {#if feedback.label === 'ok'}OK{/if}
        {#if feedback.label === 'miss'}MISS{/if}
      </div>
    {/if}
  </section>

  <div class="hud">
    <div class="stat"><span class="k">Score</span><span class="v">{score}</span></div>
    <div class="stat"><span class="k">Best</span><span class="v">{best}</span></div>
    <div class="stat"><span class="k">Combo</span><span class="v">×{combo}</span></div>
    <div class="stat lives" aria-label="lives remaining">
      <span class="k">Lives</span>
      <span class="v hearts" role="img" aria-hidden="true">
        {#each Array(3) as _, i}
          <span class:off={i >= lives}>♥</span>
        {/each}
      </span>
    </div>
  </div>

  {#if screen === 'title'}
    <div class="overlay">
      <p class="lead">A timing pulse. No reflex spam—just one clean beat.</p>
      <p class="hint">Space / tap to start</p>
    </div>
  {:else if screen === 'over'}
    <div class="overlay">
      <p class="lead gameover">Run over</p>
      <p class="scoreline">Score <strong>{score}</strong> · Best <strong>{best}</strong></p>
      <p class="hint">Space / tap to go again</p>
    </div>
  {:else}
    <p class="footer-hint">Space or tap the ring</p>
  {/if}
</main>

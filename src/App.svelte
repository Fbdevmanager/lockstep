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
  import { attachStarfield } from './lib/starfield'

  function starfield(node: HTMLCanvasElement) {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return { destroy: () => {} }
    }
    return { destroy: attachStarfield(node, { starCount: 110, speed: 0.52 }) }
  }

  type Screen = 'title' | 'play' | 'over'

  const MAX_LIVES = 4

  let screen = $state<Screen>('title')
  let score = $state(0)
  let best = $state(0)
  let lives = $state(MAX_LIVES)
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
    lives = MAX_LIVES
    combo = 1
    feedback = null
    shakeActive = false
    phase = 0
    beginCycle()
  }

  /** New run from scratch (same as a full in-app refresh, no browser reload). */
  function restartRun() {
    startRun()
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.code === 'KeyR') {
      e.preventDefault()
      restartRun()
      return
    }
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

  const nearLock = $derived(phase >= 0.8 && phase <= 1.12 && screen === 'play')
</script>

<svelte:window onkeydown={onKeydown} />

<main class:shake={shakeActive} class="shell">
  <div class="halo" aria-hidden="true"></div>

  <header class="top">
    <div class="top-row">
      <h1>Lockstep</h1>
      {#if screen === 'play' || screen === 'over'}
        <button type="button" class="btn-restart" onclick={restartRun} aria-label="Restart run">
          Restart
        </button>
      {/if}
    </div>
    <p class="tagline">Press Space when the rings meet.</p>
  </header>

  <section class="stage" aria-live="polite">
    <canvas class="starfield-canvas" use:starfield aria-hidden="true"></canvas>
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
        {#each Array(MAX_LIVES) as _, i}
          <span class:off={i >= lives}>♥</span>
        {/each}
      </span>
    </div>
  </div>

  {#if screen === 'title'}
    <div class="overlay">
      <p class="lead">A timing pulse. No reflex spam—just one clean beat.</p>
      <p class="hint">Space / tap to start · <kbd>R</kbd> anytime for a fresh run</p>
    </div>
  {:else if screen === 'over'}
    <div class="overlay">
      <p class="lead gameover">Run over</p>
      <p class="scoreline">Score <strong>{score}</strong> · Best <strong>{best}</strong></p>
      <p class="hint">Space / tap to go again · <kbd>R</kbd> for a fresh run</p>
    </div>
  {:else}
    <p class="footer-hint">Space or tap the ring · <kbd>R</kbd> or Restart for a new run</p>
  {/if}
</main>

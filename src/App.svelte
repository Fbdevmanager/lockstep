<script lang="ts">
  import { onMount } from 'svelte'
  import {
    cycleWindows,
    gradeDelta,
    gradeTimeout,
    perfectChainBonus,
    computeStress,
    type HitLabel,
    type CycleWindows,
  } from './lib/gradeHit'
  import { loadBestScore, saveBestScoreIfHigher } from './lib/scores'
  import { attachStarfield } from './lib/starfield'

  /** Read by starfield rAF each frame — not Svelte-reactive, just a mutable box. */
  const visualStress = { v: 0 }

  function starfield(node: HTMLCanvasElement) {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return { destroy: () => {} }
    }
    return {
      destroy: attachStarfield(node, {
        starCount: 118,
        speed: 0.52,
        getStress: () => visualStress.v,
      }),
    }
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

  /** Timing snapshot for the active pulse (grading + visuals stay consistent mid-cycle). */
  let activeCycle = $state<CycleWindows | null>(null)

  /** Consecutive perfects this run; resets on good/ok/miss. */
  let perfectChain = $state(0)

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
    activeCycle = cycleWindows(combo, score)
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
    activeCycle = null
    perfectChain = 0
    best = saveBestScoreIfHigher(score)
  }

  function applyGrade(label: HitLabel, points: number, nextCombo: number, livesDelta: number) {
    score += points
    combo = Math.min(10, Math.max(1, nextCombo))
    lives += livesDelta
    setFeedback(label)
    if (label === 'miss') {
      perfectChain = 0
      triggerShake()
    }
    if (lives <= 0) {
      endGame()
      return
    }
    cooldownUntil = performance.now() + 560
  }

  function tryHit() {
    if (screen !== 'play' || cycleResolved || pulseStart == null || activeCycle == null) return
    const elapsed = performance.now() - pulseStart
    const delta = elapsed - activeCycle.pulseMs
    const g = gradeDelta(delta, combo, activeCycle)
    cycleResolved = true

    let extra = 0
    if (g.label === 'perfect') {
      perfectChain += 1
      extra = perfectChainBonus(perfectChain)
    } else {
      perfectChain = 0
    }

    applyGrade(g.label, g.points + extra, g.comboAfter, g.livesDelta)
  }

  function tick(now: number) {
    if (feedback && now >= feedback.until) feedback = null

    if (screen !== 'play' || pulseStart == null || activeCycle == null) {
      visualStress.v = screen === 'title' ? 0.05 : screen === 'over' ? 0.12 : 0.06
      rafId = requestAnimationFrame(tick)
      return
    }

    visualStress.v = Math.min(1, computeStress(combo, score) * 1.72 + 0.14)

    if (cooldownUntil > 0 && now >= cooldownUntil) {
      cooldownUntil = 0
      if (lives > 0 && screen === 'play') beginCycle()
    }

    if (!cycleResolved && pulseStart != null && cooldownUntil === 0 && activeCycle != null) {
      const elapsed = now - pulseStart
      phase = elapsed / activeCycle.pulseMs
      if (elapsed > activeCycle.pulseMs + activeCycle.graceMs) {
        cycleResolved = true
        perfectChain = 0
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
    perfectChain = 0
    feedback = null
    shakeActive = false
    phase = 0
    activeCycle = null
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

  /** Game difficulty input (same as grading). */
  const rawHeat = $derived(
    screen === 'play' ? computeStress(combo, score) : screen === 'over' ? 0.16 : 0.04,
  )

  /** Boosted 0–1 for visuals only (combo/score still low early in a run). */
  const displayHeat = $derived(
    screen === 'play'
      ? Math.min(1, rawHeat * 1.72 + 0.14)
      : screen === 'over'
        ? Math.min(1, rawHeat + 0.35)
        : 0.06,
  )

  const heatTier = $derived(
    displayHeat > 0.72 ? 'high' : displayHeat > 0.38 ? 'mid' : 'low',
  )

  const baseRingScale = $derived(
    screen === 'play' && pulseStart != null && cooldownUntil === 0 && activeCycle != null
      ? 1.58 - 0.58 * Math.min(1, phase)
      : 1.58,
  )

  /** Subtle urgency wobble near the lock window when heat is high. */
  const ringWobble = $derived(
    screen === 'play' && activeCycle != null && phase >= 0.65 && phase <= 1.12
      ? displayHeat * 0.055 * Math.sin(phase * Math.PI * 5)
      : 0,
  )

  const ringScale = $derived(baseRingScale + ringWobble)

  const nearLock = $derived(phase >= 0.72 && phase <= 1.16 && screen === 'play')

  const ringBloom = $derived(16 + displayHeat * 78)
  const ringHue = $derived(displayHeat * 52)
</script>

<svelte:window onkeydown={onKeydown} />

<main
  class:shake={shakeActive}
  class="shell"
  data-heat={heatTier}
  style:--heat={displayHeat}
  style:--ring-bloom="{ringBloom}px"
  style:--ring-hue="{ringHue}deg"
>
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
    <p class="tagline">Press Space when the rings meet — windows tighten as combo and score climb.</p>
  </header>

  <section class="stage" class:stage-hot={displayHeat > 0.28} aria-live="polite">
    <canvas class="starfield-canvas" use:starfield aria-hidden="true"></canvas>
    <button
      type="button"
      class="ring-button"
      class:ring-urgent={displayHeat > 0.32 && nearLock}
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
    <div class="stat" class:stat-pulse={displayHeat > 0.36 && screen === 'play'}>
      <span class="k">Combo</span><span class="v">×{combo}</span>
    </div>
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
      <p class="lead">A timing pulse. The longer you stay clean, the faster and tighter the window gets.</p>
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

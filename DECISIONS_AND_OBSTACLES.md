# Decisions and obstacles

## Scope

- **One mechanic:** align input with a predictable pulse (fixed duration per beat). No enemies, levels, or asset pipeline—fits “ship Day 1” and keeps review easy for collaborators.
- **Persistence:** best run score only, in `localStorage`, keyed `lockstep-best-score`.
- **Stack:** Vite + Svelte + TypeScript (no SvelteKit yet) so deploy stays a static `dist/` drop until/unless a global leaderboard needs a backend.

## Key decisions

1. **Time source:** `performance.now()` for hit timing vs the pulse start, not CSS animation time (hard to read and keep in sync). The ring visual is driven by the same elapsed ratio so feedback matches what the player sees.
2. **Grace after the lock:** a short window after the ideal moment before a timeout counts as a miss, so borderline late taps still register as graded hits instead of feeling “random.”
3. **Lives + combo:** combo caps at ×10 to avoid runaway scores; misses cost a life so runs end cleanly for high-score comparison.
4. **Input:** Space for desktop, tap/click on the ring for mobile; same code path as `tryHit()`.

## Friction / tradeoffs

- **Svelte 5 runes + rAF:** phase updates every frame; had to avoid `performance.now()` inside `$derived` for transient UI (shake)—used a short `setTimeout` to clear shake instead.
- **Template vs game engine:** no Phaser/Three—visual “cool” is CSS + type instead of shaders. Faster for a beginner path; global leaderboard would be a separate service if added later.

## Optional next steps (not required for v1)

- Global scores via a tiny API + hosted KV/DB.
- Audio tick at ideal lock (Web Audio one-shot).
- Difficulty ramp (slowly shorten `PULSE_MS` over time).

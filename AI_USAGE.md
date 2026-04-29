# AI usage

## How AI was used

- **Scaffolding:** AI suggested Vite + Svelte + TS for a small deployable game and outlined the “shrinking ring / lock on beat” design from the exercise brief.
- **Implementation:** AI generated initial `App.svelte`, `gradeHit.ts`, `scores.ts`, styles, and repo docs; then iterated on timing, cooldown flow, and shake feedback from review.

## What was verified manually

- **`npm run build`** succeeds and emits `dist/`.
- **`npm run check`** (Svelte + TS) passes.
- **Gameplay smoke test:** start from title, several perfect/good/ok/miss outcomes, lives decrement on miss, game over saves best score, refresh retains best score in the same browser.

## Where AI might be wrong

- Edge timing if the browser throttles background tabs (rAF pauses)—acceptable for this scope; a future fix could clamp wall-clock delta.
- `localStorage` throws in some privacy modes; code falls back to “no persistence” without crashing.

Adjust this file as your own process evolves.

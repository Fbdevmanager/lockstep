# Lockstep

Small browser timing game: **press Space (or tap the ring)** when the inner ring meets the outer ring. Built with **Vite + Svelte 5 + TypeScript**. Best score persists in **`localStorage`** (`lockstep-best-score`).

## Local setup

- **Node.js** 20+ recommended (matches current Vite/Svelte tooling).
- Install and run:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

**Production build:**

```bash
npm run build
npm run preview   # optional: test the built files locally
```

Static output is in `dist/` — deploy that folder to any static host (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

## GitHub Pages (this repo)

1. On GitHub: **Settings → Pages → Build and deployment**.
2. Under **Source**, choose **GitHub Actions** (not “Deploy from a branch”).
3. Push to **`main`** (or run **Deploy GitHub Pages** manually under **Actions**). The workflow builds with `GITHUB_PAGES_BASE=/<repo>/` so assets load on Project Pages.
4. Live URL: **`https://<username>.github.io/<repo>/`** (e.g. `https://Fbdevmanager.github.io/lockstep/`).

Local check with the same base as production:

```bash
GITHUB_PAGES_BASE=/lockstep/ npm run build && npm run preview
```

Open the URL Vite prints (includes `/lockstep/`).

## Contributing (PR workflow)

1. **Fork** or get access to this repo and **clone** it.
2. Create a branch: `git checkout -b your-name/short-description`
3. Make your change; keep commits focused.
4. Run **`npm run check`** and **`npm run build`** before opening a PR.
5. Open a **pull request** into `main` with a short summary of what changed and why.
6. If you change gameplay or persistence, note it in `DECISIONS_AND_OBSTACLES.md` when the change is non-trivial.

## Project layout

| Path | Role |
|------|------|
| `src/App.svelte` | UI, input, animation loop, game flow |
| `src/lib/gradeHit.ts` | Timing windows and scoring (easy to tweak for balance PRs) |
| `src/lib/scores.ts` | `localStorage` read/write for best score |

## Docs for the exercise

- `DECISIONS_AND_OBSTACLES.md` — scope, tradeoffs, friction.
- `AI_USAGE.md` — how AI was used and what was verified manually.

# Contributing

Thanks for taking a look. Issues and pull requests are welcome.

## Setup

```bash
npm ci
npm run dev        # http://localhost:5173
```

Node 20.19+ (CI uses Node 22).

## Before opening a PR

```bash
npm run format:check && npm run lint && npm run typecheck && npm test && npm run build
```

CI runs the same commands plus a gitleaks secret scan.

## Guidelines

- **Game logic stays pure.** `src/games/*/logic.ts` must not touch the DOM, `window` or time;
  it gets an `InputFrame` and an `Rng` and mutates its state. That is what makes it testable.
- **Behaviour changes come with a test** in `tests/`. Write the failing test first.
- Rendering and UI changes: attach a screenshot, light and dark if it touches colour.
- Keep the bundle dependency-free at runtime. Dev dependencies are fine.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:` …).

Regenerating the README assets:

```bash
python3 scripts/diagram.py                      # architecture SVGs
npm run build && npx vite preview --port 4789 --strictPort &
npm run capture -- http://localhost:4789/       # screenshots + GIF (needs Chrome and ffmpeg)
```

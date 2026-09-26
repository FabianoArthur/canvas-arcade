import { createRng } from '../engine/rng';
import type { ScoreStore } from '../engine/storage';
import { GAMES } from '../games/registry';
import { formatScore, h } from './dom';
import { paletteFor } from './palette';

const REPO_URL = 'https://github.com/FabianoArthur/canvas-arcade';

/** Static thumbnail: the game's own renderer drawing a fresh state. */
function preview(gameId: string): HTMLCanvasElement {
  const game = GAMES.find((g) => g.id === gameId);
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  if (!game) return canvas;
  const scale = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = game.width * scale;
  canvas.height = game.height * scale;
  canvas.style.aspectRatio = `${game.width} / ${game.height}`;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(scale, scale);
    const rng = createRng(2026);
    const state = game.create(rng);
    game.render(ctx, state, paletteFor(game.id), true);
  }
  return canvas;
}

export function renderMenu(root: HTMLElement, scores: ScoreStore): void {
  const cards = GAMES.map((game) => {
    const best = scores.best(game.id);
    const link = h(
      'a',
      { class: 'card', href: `#/${game.id}`, style: `--accent: var(--${game.id})` },
      h('div', { class: 'card-preview' }, preview(game.id)),
      h(
        'div',
        { class: 'card-body' },
        h(
          'div',
          { class: 'card-title' },
          h('h2', {}, game.title),
          h('span', { class: 'best' }, best > 0 ? `Best ${formatScore(best)}` : 'No score yet'),
        ),
        h('p', {}, game.tagline),
        h('p', { class: 'keys' }, game.controls.keys),
      ),
    );
    return h('li', {}, link);
  });

  root.replaceChildren(
    h(
      'main',
      { class: 'menu' },
      h(
        'header',
        { class: 'hero' },
        h('h1', {}, 'canvas', h('span', {}, '/'), 'arcade'),
        h(
          'p',
          {},
          'Three classics rebuilt from scratch with TypeScript and the Canvas API: a fixed 60 Hz game loop, pure game logic covered by unit tests, keyboard and touch controls.',
        ),
      ),
      h('ul', { class: 'cards', 'aria-label': 'Games' }, ...cards),
      h(
        'p',
        { class: 'menu-foot' },
        'High scores stay in this browser. ',
        h('a', { href: REPO_URL }, 'Source on GitHub'),
        '.',
      ),
    ),
  );
  document.title = 'Canvas Arcade';
}

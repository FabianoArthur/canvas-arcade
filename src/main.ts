import './style.css';
import { Sfx } from './engine/audio';
import { browserStorage, createScoreStore } from './engine/storage';
import { gameById } from './games/registry';
import { renderMenu } from './ui/menu';
import { mountGame } from './ui/play';

const root = document.getElementById('main');
if (!root) throw new Error('#main missing from index.html');

const scores = createScoreStore(browserStorage());
const sfx = new Sfx(scores.soundOn());
let cleanup: (() => void) | null = null;

/** Hash routes (#/snake) work on GitHub Pages without server rewrites. */
function route(): void {
  cleanup?.();
  cleanup = null;
  // #/snake plays; #/snake/demo starts the autopilot.
  const [id = '', mode] = location.hash.replace(/^#\/?/, '').split('/');
  const game = id ? gameById(id) : undefined;
  if (game) {
    cleanup = mountGame(root as HTMLElement, game, scores, sfx, { demo: mode === 'demo' });
  } else {
    renderMenu(root as HTMLElement, scores);
    if (id) history.replaceState(null, '', location.pathname + location.search);
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();

// The skip link must not change the hash: that would be read as a route and end the game.
document.querySelector('.skip')?.addEventListener('click', (e) => {
  e.preventDefault();
  root.focus();
});

// Menu thumbnails are drawn once, so redraw them when the system theme flips.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (!cleanup) renderMenu(root, scores);
});

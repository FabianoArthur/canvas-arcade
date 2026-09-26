import type { Sfx } from '../engine/audio';
import { InputBuffer, keyToAction, type Action } from '../engine/input';
import { startLoop } from '../engine/loop';
import { createRng, randomSeed, type Rng } from '../engine/rng';
import type { ScoreStore } from '../engine/storage';
import type { GameDefinition } from '../games/types';
import { announce, formatScore, h } from './dom';
import { isDark, paletteFor, prefersReducedMotion } from './palette';

type Phase = 'ready' | 'running' | 'paused' | 'ended';

const TOUCH_LAYOUTS: Record<
  GameDefinition['touch'],
  { action: Action; label: string; name: string }[]
> = {
  dpad: [
    { action: 'up', label: '↑', name: 'Up' },
    { action: 'left', label: '←', name: 'Left' },
    { action: 'down', label: '↓', name: 'Down' },
    { action: 'right', label: '→', name: 'Right' },
  ],
  paddle: [
    { action: 'left', label: '←', name: 'Move left' },
    { action: 'action', label: 'Launch', name: 'Launch ball' },
    { action: 'right', label: '→', name: 'Move right' },
  ],
  tetris: [
    { action: 'left', label: '←', name: 'Move left' },
    { action: 'up', label: '↻', name: 'Rotate' },
    { action: 'right', label: '→', name: 'Move right' },
    { action: 'down', label: '↓', name: 'Soft drop' },
    { action: 'action', label: '⤓', name: 'Hard drop' },
  ],
};

const SWIPE_PX = 24;

/**
 * Mounts one game session. Returns a cleanup function; everything the session
 * registered (listeners, the rAF loop, observers) is torn down by it.
 */
export function mountGame(
  root: HTMLElement,
  game: GameDefinition,
  scores: ScoreStore,
  sfx: Sfx,
  options: { demo?: boolean } = {},
): () => void {
  const abort = new AbortController();
  const { signal } = abort;
  const input = new InputBuffer();

  let rng: Rng = createRng(randomSeed());
  let state = game.create(rng);
  let phase: Phase = 'ready';
  let lastScore = -1;
  let lastHud = '';
  /** Demo mode: the game's autopilot plays; any key or tap hands control to the player. */
  let demo = false;
  let pilot = game.pilot();

  // ---------- DOM ----------
  const scoreEl = h('dd', {}, '0');
  const bestEl = h('dd', {}, formatScore(scores.best(game.id)));
  const hudEl = h('p', { class: 'hud-extra' });
  const pauseBtn = h(
    'button',
    { class: 'btn', type: 'button', 'aria-label': 'Pause' },
    '❚❚',
    h('span', { class: 'label' }, 'Pause'),
  );
  const soundBtn = h('button', {
    class: 'btn',
    type: 'button',
    'aria-pressed': String(sfx.enabled),
  });
  const canvas = h('canvas', {
    role: 'img',
    'aria-label': `${game.title} board. ${game.controls.keys}.`,
  });
  const overlay = h('div', { class: 'overlay' });
  const demoTag = h(
    'p',
    { class: 'demo-tag', hidden: true },
    'Demo · press any key or tap to play',
  );
  const stage = h('div', { class: 'stage' }, canvas, overlay);
  const touch = h(
    'div',
    { class: `touch ${game.touch === 'dpad' ? 'dpad' : ''}`, 'aria-label': 'Touch controls' },
    ...TOUCH_LAYOUTS[game.touch].map((b) =>
      h('button', { type: 'button', 'data-action': b.action, 'aria-label': b.name }, b.label),
    ),
  );

  const syncSound = (): void => {
    soundBtn.setAttribute('aria-pressed', String(sfx.enabled));
    soundBtn.setAttribute('aria-label', 'Sound');
    soundBtn.replaceChildren(
      '♪',
      h('span', { class: 'label' }, sfx.enabled ? 'Sound on' : 'Sound off'),
    );
  };
  syncSound();

  root.replaceChildren(
    h(
      'section',
      { class: 'play', style: `--accent: var(--${game.id})`, 'aria-label': game.title },
      h(
        'div',
        { class: 'play-bar' },
        h('a', { class: 'btn', href: '#/' }, '←', h('span', { class: 'label' }, 'Arcade')),
        h('h1', { class: 'play-title' }, game.title),
        h(
          'dl',
          { class: 'stats' },
          h('div', {}, h('dt', {}, 'Score'), scoreEl),
          h('div', {}, h('dt', {}, 'Best'), bestEl),
        ),
        pauseBtn,
        soundBtn,
        hudEl,
      ),
      demoTag,
      stage,
      touch,
      h('p', { class: 'hint' }, `${game.controls.keys} · P / Esc to pause`),
    ),
  );
  document.title = `${game.title} · Canvas Arcade`;

  // ---------- Canvas sizing (crisp on HiDPI, fits any viewport) ----------
  const ctx = canvas.getContext('2d');
  let scale = 1;
  const fit = (): void => {
    const box = stage.getBoundingClientRect();
    const s = Math.max(0.1, Math.min(box.width / game.width, box.height / game.height));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.width = `${Math.floor(game.width * s)}px`;
    canvas.style.height = `${Math.floor(game.height * s)}px`;
    canvas.width = Math.floor(game.width * s * dpr);
    canvas.height = Math.floor(game.height * s * dpr);
    scale = s * dpr;
  };
  const resize = new ResizeObserver(fit);
  resize.observe(stage);
  fit();

  let palette = paletteFor(game.id);
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  darkMq.addEventListener('change', () => (palette = paletteFor(game.id, isDark())), { signal });
  const reducedMotion = prefersReducedMotion();

  // ---------- Overlay ----------
  const showOverlay = (...content: Node[]): void => {
    overlay.replaceChildren(h('div', { class: 'panel' }, ...content));
    overlay.hidden = false;
  };
  const hideOverlay = (): void => {
    overlay.hidden = true;
    overlay.replaceChildren();
  };

  const showReady = (): void => {
    showOverlay(
      h('h2', {}, game.title),
      h('p', {}, game.tagline),
      h(
        'p',
        {},
        matchMedia('(pointer: coarse)').matches ? game.controls.touch : game.controls.keys,
      ),
      h(
        'div',
        { class: 'panel-actions' },
        button('Start', 'primary', start),
        button('Watch demo', '', startDemo),
      ),
    );
  };

  const showPaused = (): void => {
    showOverlay(
      h('h2', {}, 'Paused'),
      h('p', {}, 'P / Esc to resume'),
      h(
        'div',
        { class: 'panel-actions' },
        button('Resume', 'primary', resume),
        h('a', { class: 'btn', href: '#/' }, 'Menu'),
      ),
    );
  };

  const showEnded = (isBest: boolean, rank: number | null): void => {
    const top = scores.top(game.id);
    const list = h(
      'ol',
      { class: 'scores', 'aria-label': 'Top scores' },
      ...top.map((e, i) =>
        h(
          'li',
          { class: i + 1 === rank ? 'mine' : undefined },
          h('span', {}, formatScore(e.score)),
        ),
      ),
    );
    const won = state.status === 'won';
    showOverlay(
      h('h2', {}, won ? 'You win' : 'Game over'),
      h('p', { class: 'final' }, formatScore(state.score)),
      isBest
        ? h('span', { class: 'badge' }, 'New best')
        : h('p', {}, `Best ${formatScore(scores.best(game.id))}`),
      top.length > 0 ? list : h('p', {}, 'Score something to get on the board.'),
      h(
        'div',
        { class: 'panel-actions' },
        button('Play again', 'primary', restart),
        h('a', { class: 'btn', href: '#/' }, 'Menu'),
      ),
    );
    overlay.querySelector<HTMLButtonElement>('.btn.primary')?.focus();
    announce(
      `${won ? 'You win' : 'Game over'}. Score ${formatScore(state.score)}.${isBest ? ' New best!' : ''}`,
    );
  };

  function button(text: string, variant: string, onClick: () => void): HTMLButtonElement {
    const b = h('button', { class: `btn ${variant}`, type: 'button' }, text);
    b.addEventListener('click', onClick, { signal });
    return b;
  }

  // ---------- Phase transitions ----------
  function start(): void {
    sfx.unlock();
    input.clear();
    phase = 'running';
    hideOverlay();
    canvas.focus({ preventScroll: true });
  }

  function resume(): void {
    if (phase !== 'paused') return;
    start();
  }

  function pause(): void {
    if (phase !== 'running') return;
    phase = 'paused';
    input.clear();
    showPaused();
  }

  function restart(): void {
    rng = createRng(randomSeed());
    state = game.create(rng);
    demo = false;
    demoTag.hidden = true;
    start();
  }

  function startDemo(): void {
    rng = createRng(randomSeed());
    state = game.create(rng);
    pilot = game.pilot();
    demo = true;
    demoTag.hidden = false;
    start();
  }

  function end(): void {
    if (demo) {
      startDemo(); // demo loops forever and never touches the high scores
      return;
    }
    phase = 'ended';
    input.clear();
    const { isBest, rank } = scores.submit(game.id, state.score);
    bestEl.textContent = formatScore(scores.best(game.id));
    showEnded(isBest, rank);
  }

  pauseBtn.addEventListener(
    'click',
    () => {
      if (phase === 'paused') resume();
      else pause();
    },
    { signal },
  );
  soundBtn.addEventListener(
    'click',
    () => {
      sfx.enabled = !sfx.enabled;
      scores.setSoundOn(sfx.enabled);
      sfx.unlock();
      syncSound();
    },
    { signal },
  );

  // ---------- Keyboard ----------
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const action = keyToAction(e.code);
      if (!action) return;
      // Let focused buttons/links handle Enter/Space themselves.
      const target = e.target as HTMLElement | null;
      if ((e.code === 'Enter' || e.code === 'Space') && target?.closest('button, a')) return;
      e.preventDefault();
      if (phase === 'ready' && action !== 'pause') {
        start();
        return;
      }
      if (demo && phase === 'running' && action !== 'pause') {
        restart();
        return;
      }
      if (action === 'pause') {
        if (phase === 'running') pause();
        else if (phase === 'paused') resume();
        return;
      }
      if (phase !== 'running') return;
      input.setPointerX(null);
      input.press(action);
    },
    { signal },
  );
  window.addEventListener(
    'keyup',
    (e) => {
      const action = keyToAction(e.code);
      if (action) input.release(action);
    },
    { signal },
  );

  // Losing focus (tab switch, alt-tab) pauses instead of letting the game run blind.
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) pause();
    },
    { signal },
  );
  window.addEventListener(
    'blur',
    () => {
      pause();
    },
    { signal },
  );

  // ---------- Touch buttons ----------
  const markTouch = (): void => {
    document.documentElement.classList.add('touch-seen');
  };
  for (const btn of touch.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
    const action = btn.dataset.action as Action;
    const up = (): void => {
      btn.classList.remove('down');
      input.release(action);
    };
    btn.addEventListener(
      'pointerdown',
      (e) => {
        e.preventDefault();
        markTouch();
        if (phase === 'ready') start();
        else if (demo && phase === 'running') restart();
        if (phase !== 'running') return;
        btn.setPointerCapture(e.pointerId);
        btn.classList.add('down');
        input.press(action);
      },
      { signal },
    );
    btn.addEventListener('pointerup', up, { signal });
    btn.addEventListener('pointercancel', up, { signal });
    btn.addEventListener('lostpointercapture', up, { signal });
  }

  // ---------- Canvas pointer: swipe (Snake), drag / mouse (Breakout), tap ----------
  let swipeFrom: { x: number; y: number } | null = null;
  const pointerX = (e: PointerEvent): number => {
    const r = canvas.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse') markTouch();
      if (phase === 'ready') {
        start();
        return;
      }
      if (demo && phase === 'running') {
        restart();
        return;
      }
      if (phase !== 'running') return;
      canvas.setPointerCapture(e.pointerId);
      swipeFrom = { x: e.clientX, y: e.clientY };
      if (game.touch === 'paddle') {
        input.setPointerX(pointerX(e));
        input.press('action');
        input.release('action');
      }
    },
    { signal },
  );
  canvas.addEventListener(
    'pointermove',
    (e) => {
      if (phase !== 'running') return;
      if (game.touch === 'paddle' && (e.pointerType === 'mouse' || swipeFrom)) {
        input.setPointerX(pointerX(e));
      }
      if (game.touch === 'dpad' && swipeFrom) {
        const dx = e.clientX - swipeFrom.x;
        const dy = e.clientY - swipeFrom.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
        const dir: Action =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        input.press(dir);
        input.release(dir);
        swipeFrom = { x: e.clientX, y: e.clientY };
      }
    },
    { signal },
  );
  const endPointer = (e: PointerEvent): void => {
    swipeFrom = null;
    if (game.touch === 'paddle' && e.pointerType !== 'mouse') input.setPointerX(null);
  };
  canvas.addEventListener('pointerup', endPointer, { signal });
  canvas.addEventListener('pointercancel', endPointer, { signal });
  canvas.addEventListener(
    'pointerleave',
    (e) => {
      if (e.pointerType === 'mouse') input.setPointerX(null);
    },
    { signal },
  );
  canvas.tabIndex = 0;

  // ---------- Loop ----------
  const loop = startLoop({
    step() {
      if (phase !== 'running') return;
      const playerInput = input.frame(); // always drained, so demo keys don't pile up
      game.update(state, demo ? pilot(state) : playerInput, rng);
      sfx.play(state.events);
      if (state.status !== 'playing') end();
    },
    render() {
      if (!ctx) return;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      game.render(ctx, state, palette, reducedMotion);
      if (state.score !== lastScore) {
        lastScore = state.score;
        scoreEl.textContent = formatScore(state.score);
      }
      const hud = game.hud(state);
      if (hud !== lastHud) {
        lastHud = hud;
        hudEl.textContent = hud;
      }
    },
  });

  if (options.demo) startDemo();
  else showReady();

  return () => {
    loop.stop();
    resize.disconnect();
    abort.abort();
  };
}

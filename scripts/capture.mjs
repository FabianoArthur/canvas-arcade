// Captures the README screenshots and demo GIF from a running build.
//
//   npm run build && npx vite preview --port 4789 --strictPort &
//   npm run capture -- http://localhost:4789/
//
// Uses the Chrome already installed on the machine (playwright-core, no browser
// download) and ffmpeg for the GIF. Every capture runs the game's demo mode
// (#/<id>/demo), where the built-in autopilot plays.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173/';
const out = new URL('../docs/assets/', import.meta.url).pathname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function open(colorScheme, viewport, extra = {}) {
  const context = await browser.newContext({
    colorScheme,
    viewport,
    deviceScaleFactor: 2,
    ...extra,
  });
  const p = await context.newPage();
  p.on('pageerror', (e) => failures.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error') failures.push(m.text());
  });
  return { p, context };
}

async function demo(p, id) {
  await p.goto(`${base}#/${id}/demo`);
  await p.waitForSelector('canvas');
}

// Menu, light and dark.
for (const scheme of ['light', 'dark']) {
  const { p, context } = await open(scheme, { width: 1200, height: 800 });
  await p.goto(base);
  await p.waitForSelector('.card');
  await p.screenshot({ path: `${out}menu-${scheme}.png` });
  await context.close();
}

// Each game mid-play (dark).
const PLAY_MS = { snake: 9000, breakout: 7000, tetris: 12000 };
for (const id of ['snake', 'breakout', 'tetris']) {
  const { p, context } = await open('dark', { width: 760, height: 820 });
  await demo(p, id);
  await sleep(PLAY_MS[id]);
  await p.screenshot({ path: `${out}${id}.png` });
  await context.close();
}

// Phone-sized Tetris with the touch controls (light).
{
  const { p, context } = await open(
    'light',
    { width: 390, height: 780 },
    { hasTouch: true, isMobile: true },
  );
  await demo(p, 'tetris');
  await sleep(8000);
  await p.screenshot({ path: `${out}mobile-tetris.png` });
  await context.close();
}

// Demo GIF: a short clip per game, captured frame by frame.
const frames = mkdtempSync(join(tmpdir(), 'arcade-frames-'));
let n = 0;
for (const id of ['snake', 'breakout', 'tetris']) {
  const { p, context } = await open('dark', { width: 640, height: 700 });
  await demo(p, id);
  await sleep(1500);
  for (let i = 0; i < 40; i++) {
    await p.screenshot({
      path: join(frames, `f${String(n++).padStart(4, '0')}.png`),
      scale: 'css',
    });
    await sleep(60);
  }
  await context.close();
}
execFileSync('ffmpeg', [
  '-y',
  '-loglevel',
  'error',
  '-framerate',
  '10',
  '-i',
  join(frames, 'f%04d.png'),
  '-vf',
  'scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=64:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4',
  `${out}demo.gif`,
]);
rmSync(frames, { recursive: true, force: true });

await browser.close();
if (failures.length) {
  console.error('Page errors:\n' + failures.join('\n'));
  process.exit(1);
}
console.log(`Captured screenshots and a ${n}-frame GIF into docs/assets/`);

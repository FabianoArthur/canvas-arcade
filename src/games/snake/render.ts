import type { Palette } from '../types';
import { roundRect } from '../draw';
import type { SnakeState } from './logic';

export const CELL = 20;

export function renderSnake(
  ctx: CanvasRenderingContext2D,
  s: SnakeState,
  p: Palette,
  reducedMotion: boolean,
): void {
  const w = s.cols * CELL;
  const h = s.rows * CELL;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, w, h);

  // Checkerboard so speed and position read at a glance.
  ctx.fillStyle = p.grid;
  for (let y = 0; y < s.rows; y++) {
    for (let x = y % 2; x < s.cols; x += 2) ctx.fillRect(x * CELL, y * CELL, CELL, CELL);
  }

  // Food, with a gentle pulse.
  const t = reducedMotion ? 0 : performance.now() / 300;
  const r = CELL * (0.3 + 0.05 * Math.sin(t));
  ctx.fillStyle = p.danger;
  ctx.beginPath();
  ctx.arc(s.food.x * CELL + CELL / 2, s.food.y * CELL + CELL / 2, r, 0, Math.PI * 2);
  ctx.fill();

  // Body: tail fades toward the muted colour.
  const n = s.body.length;
  s.body.forEach((c, i) => {
    ctx.globalAlpha = i === 0 ? 1 : 0.95 - (0.45 * i) / Math.max(1, n - 1);
    ctx.fillStyle = p.accent;
    roundRect(ctx, c.x * CELL + 1.5, c.y * CELL + 1.5, CELL - 3, CELL - 3, i === 0 ? 6 : 4);
  });
  ctx.globalAlpha = 1;

  // Eyes, looking where the snake is going.
  const head = s.body[0];
  if (head) {
    const cx = head.x * CELL + CELL / 2;
    const cy = head.y * CELL + CELL / 2;
    const d = s.queue[0] ?? s.dir;
    const px = -d.y;
    const py = d.x;
    ctx.fillStyle = p.bg;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + d.x * 4 + px * 4 * side, cy + d.y * 4 + py * 4 * side, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

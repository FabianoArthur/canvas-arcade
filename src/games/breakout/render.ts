import type { Palette } from '../types';
import { label, roundRect } from '../draw';
import { HEIGHT, WIDTH, type BreakoutState } from './logic';

/** Row colours, top to bottom — warm to cool, like the cabinet. */
const ROW_HUES = [4, 22, 38, 52, 140, 200];

export function renderBreakout(ctx: CanvasRenderingContext2D, s: BreakoutState, p: Palette): void {
  const { dark } = p;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const b of s.bricks) {
    if (!b.alive) continue;
    const hue = ROW_HUES[b.row] ?? 200;
    ctx.fillStyle = dark ? `hsl(${hue} 80% 62%)` : `hsl(${hue} 70% 46%)`;
    roundRect(ctx, b.x, b.y, b.w, b.h, 4);
  }

  ctx.fillStyle = p.fg;
  const { paddle } = s;
  roundRect(ctx, paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, paddle.h / 2);

  ctx.fillStyle = p.accent;
  ctx.beginPath();
  ctx.arc(s.ball.x, s.ball.y, s.ball.r, 0, Math.PI * 2);
  ctx.fill();

  if (s.stuck && s.status === 'playing') {
    label(ctx, 'SPACE / TAP TO LAUNCH', WIDTH / 2, HEIGHT - 100, p.muted, 14);
  }
}

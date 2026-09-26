import type { Palette } from '../types';
import { label, roundRect } from '../draw';
import {
  COLS,
  HIDDEN_ROWS,
  ROWS,
  cellsOf,
  dropDistance,
  type PieceType,
  type TetrisState,
} from './logic';

export const CELL = 28;
export const BOARD_W = COLS * CELL;
export const BOARD_H = (ROWS - HIDDEN_ROWS) * CELL;
export const SIDE_W = 132;

const HUES: Record<PieceType, number> = { I: 188, J: 222, L: 30, O: 50, S: 130, T: 285, Z: 2 };

const colorOf = (t: PieceType, dark: boolean): string =>
  dark ? `hsl(${HUES[t]} 75% 62%)` : `hsl(${HUES[t]} 65% 45%)`;

function block(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 4);
}

export function renderTetris(ctx: CanvasRenderingContext2D, s: TetrisState, p: Palette): void {
  const { dark } = p;
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, BOARD_W + SIDE_W, BOARD_H);

  // Well
  ctx.fillStyle = p.grid;
  for (let y = 0; y < ROWS - HIDDEN_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);
    }
  }

  // Settled blocks
  for (let y = HIDDEN_ROWS; y < ROWS; y++) {
    const row = s.board[y];
    if (!row) continue;
    row.forEach((cell, x) => {
      if (!cell) return;
      ctx.fillStyle = colorOf(cell, dark);
      block(ctx, x * CELL, (y - HIDDEN_ROWS) * CELL, CELL);
    });
  }

  if (s.status === 'playing') {
    // Ghost: where a hard drop would land.
    const d = dropDistance(s);
    ctx.strokeStyle = colorOf(s.piece.type, dark);
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 2;
    for (const c of cellsOf({ ...s.piece, y: s.piece.y + d })) {
      if (c.y < HIDDEN_ROWS) continue;
      ctx.beginPath();
      ctx.roundRect(c.x * CELL + 3, (c.y - HIDDEN_ROWS) * CELL + 3, CELL - 6, CELL - 6, 3);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = colorOf(s.piece.type, dark);
    for (const c of cellsOf(s.piece)) {
      if (c.y < HIDDEN_ROWS) continue;
      block(ctx, c.x * CELL, (c.y - HIDDEN_ROWS) * CELL, CELL);
    }
  }

  // Side panel
  const sx = BOARD_W;
  ctx.fillStyle = p.grid;
  ctx.fillRect(sx, 0, 2, BOARD_H);
  const cx = sx + SIDE_W / 2;
  label(ctx, 'NEXT', cx, 28, p.muted, 13);
  const mini = 16;
  s.queue.slice(0, 3).forEach((type, i) => {
    const cells = cellsOf({ type, rot: 0, x: 0, y: 0 });
    const minX = Math.min(...cells.map((c) => c.x));
    const maxX = Math.max(...cells.map((c) => c.x));
    const minY = Math.min(...cells.map((c) => c.y));
    const maxY = Math.max(...cells.map((c) => c.y));
    const ox = cx - ((maxX - minX + 1) * mini) / 2;
    const oy = 56 + i * 64 + (2 - (maxY - minY + 1)) * (mini / 2);
    ctx.fillStyle = colorOf(type, dark);
    for (const c of cells) block(ctx, ox + (c.x - minX) * mini, oy + (c.y - minY) * mini, mini);
  });

  label(ctx, 'LEVEL', cx, 280, p.muted, 13);
  label(ctx, String(s.level), cx, 306, p.fg, 24);
  label(ctx, 'LINES', cx, 350, p.muted, 13);
  label(ctx, String(s.lines), cx, 376, p.fg, 24);
}

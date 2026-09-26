import type { InputFrame } from '../../engine/input';
import { pilotFrame } from '../pilot';
import {
  COLS,
  ROWS,
  cellsOf,
  fits,
  gravityInterval,
  type Cell,
  type Piece,
  type TetrisState,
} from './logic';

/** Steps between pilot inputs — slow enough to watch, but never slower than gravity allows. */
const PACE = 4;

interface Plan {
  rot: number;
  x: number;
}

/** Classic heuristic weights (height, lines, holes, bumpiness). */
function evaluate(board: Cell[][]): { height: number; holes: number; bump: number; lines: number } {
  const full = board.filter((row) => row.every((c) => c !== null)).length;
  const rest = board.filter((row) => !row.every((c) => c !== null));
  while (rest.length < ROWS) rest.unshift(Array<Cell>(COLS).fill(null));
  const heights: number[] = [];
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let top = ROWS;
    for (let y = 0; y < ROWS; y++) {
      if (rest[y]?.[x] !== null) {
        top = Math.min(top, y);
      } else if (top < y) holes++;
    }
    heights.push(ROWS - top);
  }
  let bump = 0;
  for (let x = 1; x < COLS; x++) bump += Math.abs((heights[x] ?? 0) - (heights[x - 1] ?? 0));
  return { height: heights.reduce((a, b) => a + b, 0), holes, bump, lines: full };
}

function bestPlan(s: TetrisState): Plan {
  let best: { plan: Plan; score: number } | null = null;
  for (let rot = 0; rot < 4; rot++) {
    const rotated: Piece = { ...s.piece, rot };
    if (!fits(s.board, rotated)) continue;
    for (const dir of [-1, 1]) {
      for (let x = rotated.x; ; x += dir) {
        const p = { ...rotated, x };
        if (!fits(s.board, p)) break;
        let y = p.y;
        while (fits(s.board, { ...p, y: y + 1 })) y++;
        const board = s.board.map((row) => [...row]);
        for (const c of cellsOf({ ...p, y })) {
          const row = board[c.y];
          if (row) row[c.x] = p.type;
        }
        const e = evaluate(board);
        const score = -0.51 * e.height + 0.76 * e.lines - 0.36 * e.holes - 0.18 * e.bump;
        if (!best || score > best.score) best = { plan: { rot, x }, score };
      }
    }
  }
  return best?.plan ?? { rot: s.piece.rot, x: s.piece.x };
}

/** Demo-mode player: pick the best landing spot, rotate, slide, hard-drop. */
export function tetrisPilot(): (s: TetrisState) => InputFrame {
  let plan: Plan | null = null;
  let steps = 0;
  return (s) => {
    steps += 1;
    if (plan === null || s.events.includes('lock')) plan = bestPlan(s);
    const pace = gravityInterval(s.level) > 12 ? PACE : 1;
    if (steps % pace !== 0) return pilotFrame();
    if (s.piece.rot !== plan.rot) return pilotFrame(['up']);
    if (s.piece.x !== plan.x) return pilotFrame([s.piece.x < plan.x ? 'right' : 'left']);
    plan = null;
    return pilotFrame(['action']);
  };
}

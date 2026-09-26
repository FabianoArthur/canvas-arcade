import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng';
import {
  COLS,
  HIDDEN_ROWS,
  LOCK_DELAY,
  ROWS,
  cellsOf,
  createTetris,
  dropDistance,
  gravityInterval,
  updateTetris,
  type PieceType,
  type TetrisState,
} from '../../src/games/tetris/logic';
import { frame, idle } from '../helpers';

const rng = () => createRng(11);

function place(s: TetrisState, type: PieceType, x: number, y: number, rot = 0): void {
  s.piece = { type, x, y, rot };
  s.gravityCounter = 0;
  s.lockCounter = 0;
}

function fillRow(s: TetrisState, row: number, except: number[] = []): void {
  for (let x = 0; x < COLS; x++) s.board[row]![x] = except.includes(x) ? null : 'Z';
}

const cellSet = (s: TetrisState) =>
  cellsOf(s.piece)
    .map((c) => `${c.x},${c.y}`)
    .sort();

describe('tetris', () => {
  it('deals pieces from a 7-bag: every 7 pieces contain each type once', () => {
    const s = createTetris(rng());
    const seen: PieceType[] = [s.piece.type];
    while (seen.length < 14) {
      updateTetris(s, frame(['action']), rng()); // hard drop → next piece
      for (const row of s.board) row.fill(null); // never top out mid-test
      seen.push(s.piece.type);
    }
    expect(new Set(seen.slice(0, 7)).size).toBe(7);
    expect(new Set(seen.slice(7, 14)).size).toBe(7);
  });

  it('spawns centred at the top of the visible field', () => {
    const s = createTetris(rng());
    const xs = cellsOf(s.piece).map((c) => c.x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...xs)).toBeLessThanOrEqual(6);
    expect(Math.max(...cellsOf(s.piece).map((c) => c.y))).toBeLessThanOrEqual(HIDDEN_ROWS + 1);
  });

  it('moves left/right and stops at the walls', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 10);
    updateTetris(s, frame(['left']), rng());
    expect(s.piece.x).toBe(3);
    for (let i = 0; i < 40; i++) {
      updateTetris(s, frame(i % 2 ? [] : ['left']), rng());
      s.piece.y = 10;
    }
    expect(Math.min(...cellsOf(s.piece).map((c) => c.x))).toBe(0);
  });

  it('auto-repeats a held direction after a delay (DAS)', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 10);
    updateTetris(s, frame(['right'], ['right']), rng());
    expect(s.piece.x).toBe(5);
    for (let i = 0; i < 5; i++) updateTetris(s, frame([], ['right']), rng());
    expect(s.piece.x).toBe(5);
    for (let i = 0; i < 20; i++) {
      updateTetris(s, frame([], ['right']), rng());
      s.piece.y = 10;
    }
    expect(s.piece.x).toBeGreaterThan(5);
  });

  it('rotates a T through four states and back', () => {
    const s = createTetris(rng());
    place(s, 'T', 4, 10);
    const start = cellSet(s);
    const states = new Set<string>();
    for (let i = 0; i < 4; i++) {
      updateTetris(s, frame(['up']), rng());
      states.add(cellSet(s).join('|'));
    }
    expect(states.size).toBe(4);
    expect(cellSet(s)).toEqual(start);
  });

  it('wall-kicks an I piece off the right wall instead of refusing to rotate', () => {
    const s = createTetris(rng());
    // Vertical I hugging the right wall (state R occupies box column 2).
    place(s, 'I', COLS - 3, 10, 1);
    expect(Math.max(...cellsOf(s.piece).map((c) => c.x))).toBe(COLS - 1);
    updateTetris(s, frame(['up']), rng());
    expect(s.piece.rot).toBe(2);
    const xs = cellsOf(s.piece).map((c) => c.x);
    expect(Math.max(...xs)).toBeLessThanOrEqual(COLS - 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });

  it('refuses a rotation when no kick fits', () => {
    const s = createTetris(rng());
    // Fill everything except the T's own cells so every kick collides.
    for (let y = 0; y < ROWS; y++) fillRow(s, y);
    place(s, 'T', 4, 10);
    for (const c of cellsOf(s.piece)) s.board[c.y]![c.x] = null;
    updateTetris(s, frame(['up']), rng());
    expect(s.piece.rot).toBe(0);
  });

  it('falls one row per gravity interval', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 5);
    for (let i = 0; i < gravityInterval(1) - 1; i++) updateTetris(s, idle(), rng());
    expect(s.piece.y).toBe(5);
    updateTetris(s, idle(), rng());
    expect(s.piece.y).toBe(6);
  });

  it('gravity gets faster with level', () => {
    expect(gravityInterval(5)).toBeLessThan(gravityInterval(1));
    expect(gravityInterval(30)).toBeGreaterThanOrEqual(1);
  });

  it('soft drop moves faster and scores 1 per row', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 5);
    for (let i = 0; i < 10; i++) updateTetris(s, frame([], ['down']), rng());
    expect(s.piece.y).toBeGreaterThanOrEqual(9);
    expect(s.score).toBe(s.piece.y - 5);
  });

  it('hard drop lands, locks, scores 2 per row and spawns the next piece', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 5);
    const distance = dropDistance(s);
    const next = s.queue[0];
    updateTetris(s, frame(['action']), rng());
    expect(s.score).toBe(distance * 2);
    expect(s.board[ROWS - 1]![5]).toBe('O');
    expect(s.board[ROWS - 1]![6]).toBe('O');
    expect(s.piece.type).toBe(next);
    expect(s.events).toContain('lock');
  });

  it('waits a lock delay before locking a resting piece, and a move resets it', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, ROWS - 2);
    for (let i = 0; i < LOCK_DELAY - 1; i++) updateTetris(s, idle(), rng());
    expect(s.piece.type).toBe('O');
    expect(s.board[ROWS - 1]![5]).toBeNull();
    updateTetris(s, frame(['left']), rng()); // successful move resets the timer
    for (let i = 0; i < LOCK_DELAY - 2; i++) updateTetris(s, idle(), rng());
    expect(s.board[ROWS - 1]![4]).toBeNull();
    for (let i = 0; i < 3; i++) updateTetris(s, idle(), rng());
    expect(s.board[ROWS - 1]![4]).toBe('O');
  });

  it('clears a single line for 100 × level and shifts rows down', () => {
    const s = createTetris(rng());
    fillRow(s, ROWS - 1, [0, 1]);
    s.board[ROWS - 2]![5] = 'T';
    place(s, 'O', -1, 5); // O occupies box columns 1–2 → board x 0–1
    updateTetris(s, frame(['action']), rng());
    expect(s.lines).toBe(1);
    expect(s.events).toContain('clear');
    // Hard drop points + line points.
    expect(s.score).toBe(dropDistanceScore(5, ROWS - 2) + 100);
    expect(s.board[ROWS - 1]![5]).toBe('T');
    expect(s.board[ROWS - 1]![0]).toBe('O');
  });

  it('scores a tetris (4 lines) as 800 × level', () => {
    const s = createTetris(rng());
    for (let r = ROWS - 4; r < ROWS; r++) fillRow(s, r, [0]);
    place(s, 'I', -2, 5, 1); // vertical I in column 0
    updateTetris(s, frame(['action']), rng());
    expect(s.lines).toBe(4);
    expect(s.events).toContain('tetris');
    expect(s.score).toBe(dropDistanceScore(5, ROWS - 4) + 800);
    expect(s.board.flat().filter(Boolean)).toHaveLength(0);
  });

  it('levels up every 10 lines', () => {
    const s = createTetris(rng());
    s.lines = 9;
    fillRow(s, ROWS - 1, [0, 1]);
    place(s, 'O', -1, 5);
    updateTetris(s, frame(['action']), rng());
    expect(s.level).toBe(2);
    expect(s.events).toContain('level');
  });

  it('tops out when a new piece cannot spawn', () => {
    const s = createTetris(rng());
    // A stack up to the top with one hole per row, so nothing clears.
    for (let y = HIDDEN_ROWS; y < ROWS; y++) fillRow(s, y, [y % 3]);
    place(s, 'O', 3, 0);
    updateTetris(s, frame(['action']), rng());
    expect(s.status).toBe('over');
    expect(s.events).toContain('over');
  });

  it('dropDistance powers the ghost piece', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 5);
    expect(dropDistance(s)).toBe(ROWS - 2 - 5);
  });
});

/** Hard drop from row y0 to y1 is worth 2 per row. */
function dropDistanceScore(y0: number, y1: number): number {
  return (y1 - y0) * 2;
}

describe('tetris lock delay resets', () => {
  it('moves made while falling do not use up the resets available on the ground', () => {
    const s = createTetris(rng());
    place(s, 'O', 4, 2);
    s.lockResets = 0;
    // 20 shifts during the fall, alternating so the piece stays in place.
    for (let i = 0; i < 20; i++) updateTetris(s, frame([i % 2 ? 'left' : 'right']), rng());
    s.piece.y = ROWS - 2; // now resting on the floor
    s.lockCounter = 0;
    for (let i = 0; i < LOCK_DELAY - 2; i++) updateTetris(s, idle(), rng());
    updateTetris(s, frame(['left']), rng()); // should still buy a fresh lock delay
    for (let i = 0; i < LOCK_DELAY - 2; i++) updateTetris(s, idle(), rng());
    expect(s.piece.type).toBe('O');
    expect(s.events).not.toContain('lock');
  });
});

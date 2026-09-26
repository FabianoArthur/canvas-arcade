import type { InputFrame } from '../../engine/input';
import type { Rng } from '../../engine/rng';
import type { BaseState } from '../types';

export interface Cell {
  x: number;
  y: number;
}

export interface SnakeState extends BaseState {
  cols: number;
  rows: number;
  /** Head first. */
  body: Cell[];
  dir: Cell;
  /** Turns waiting for the next moves (max 2), so quick double-taps aren't lost. */
  queue: Cell[];
  food: Cell;
  /** Fixed steps between moves; drops as the snake eats. */
  interval: number;
  sinceMove: number;
  eaten: number;
}

export const BASE_INTERVAL = 8; // 7.5 moves/s at 60 Hz
export const MIN_INTERVAL = 4; // 15 moves/s
const FOODS_PER_SPEEDUP = 4;
const MAX_QUEUE = 2;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const;

const same = (a: Cell, b: Cell): boolean => a.x === b.x && a.y === b.y;

function placeFood(s: SnakeState, rng: Rng): Cell {
  const taken = new Set(s.body.map((c) => c.y * s.cols + c.x));
  const free: number[] = [];
  for (let i = 0; i < s.cols * s.rows; i++) if (!taken.has(i)) free.push(i);
  const idx = free[rng.int(free.length)] ?? 0;
  return { x: idx % s.cols, y: Math.floor(idx / s.cols) };
}

export function createSnake(rng: Rng, size = { cols: 20, rows: 20 }): SnakeState {
  const y = Math.floor(size.rows / 2);
  const x = Math.max(2, Math.floor(size.cols / 3));
  const s: SnakeState = {
    ...size,
    body: [
      { x, y },
      { x: x - 1, y },
      { x: x - 2, y },
    ],
    dir: { ...DIRS.right },
    queue: [],
    food: { x: 0, y: 0 },
    interval: BASE_INTERVAL,
    sinceMove: 0,
    eaten: 0,
    score: 0,
    status: 'playing',
    events: [],
  };
  s.food = placeFood(s, rng);
  return s;
}

function queueTurns(s: SnakeState, input: InputFrame): void {
  for (const action of input.order) {
    if (action !== 'up' && action !== 'down' && action !== 'left' && action !== 'right') continue;
    const next = DIRS[action];
    const last = s.queue[s.queue.length - 1] ?? s.dir;
    // No reversal and no no-op, judged against the last *queued* direction.
    if (same(next, last) || (next.x === -last.x && next.y === -last.y)) continue;
    if (s.queue.length < MAX_QUEUE) s.queue.push({ ...next });
  }
}

function move(s: SnakeState, rng: Rng): void {
  s.dir = s.queue.shift() ?? s.dir;
  const head = s.body[0];
  if (!head) return;
  const next = { x: head.x + s.dir.x, y: head.y + s.dir.y };

  if (next.x < 0 || next.y < 0 || next.x >= s.cols || next.y >= s.rows) {
    s.status = 'over';
    s.events.push('over');
    return;
  }

  const eating = same(next, s.food);
  // The tail moves out of the way this turn unless we're growing.
  const obstacles = eating ? s.body : s.body.slice(0, -1);
  if (obstacles.some((c) => same(c, next))) {
    s.status = 'over';
    s.events.push('over');
    return;
  }

  s.body.unshift(next);
  if (!eating) {
    s.body.pop();
    return;
  }

  s.eaten += 1;
  s.score += 10;
  s.events.push('eat');
  s.interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - Math.floor(s.eaten / FOODS_PER_SPEEDUP));
  if (s.body.length === s.cols * s.rows) {
    s.status = 'won';
    s.events.push('won');
    return;
  }
  s.food = placeFood(s, rng);
}

export function updateSnake(s: SnakeState, input: InputFrame, rng: Rng): void {
  s.events = [];
  if (s.status !== 'playing') return;
  queueTurns(s, input);
  s.sinceMove += 1;
  if (s.sinceMove >= s.interval) {
    s.sinceMove = 0;
    move(s, rng);
  }
}

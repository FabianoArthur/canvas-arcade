import type { InputFrame } from '../../engine/input';
import type { Rng } from '../../engine/rng';
import type { BaseState } from '../types';

export const COLS = 10;
/** Two hidden rows above the 20 visible ones, where pieces spawn. */
export const HIDDEN_ROWS = 2;
export const ROWS = 20 + HIDDEN_ROWS;
export const LOCK_DELAY = 30; // steps (0.5 s)
const MAX_LOCK_RESETS = 15;
const DAS = 10; // steps before a held direction auto-repeats
const ARR = 2; // steps between repeats
const SOFT_DROP_INTERVAL = 2;
const LINE_POINTS = [0, 100, 300, 500, 800];
const SPAWN_X = 3;
const SPAWN_Y = 1;

export type PieceType = 'I' | 'J' | 'L' | 'O' | 'S' | 'T' | 'Z';
export const PIECE_TYPES: readonly PieceType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

interface Point {
  x: number;
  y: number;
}

export interface Piece {
  type: PieceType;
  /** Rotation state 0 (spawn), 1 (R), 2, 3 (L). */
  rot: number;
  /** Top-left of the piece's bounding box. */
  x: number;
  y: number;
}

export type Cell = PieceType | null;

export interface TetrisState extends BaseState {
  board: Cell[][];
  piece: Piece;
  /** Upcoming pieces; refilled from shuffled bags of all seven. */
  queue: PieceType[];
  lines: number;
  level: number;
  gravityCounter: number;
  lockCounter: number;
  lockResets: number;
  /** Lowest row the current piece has reached; a new low refills its lock resets. */
  lowestY: number;
  das: { dir: 'left' | 'right' | null; counter: number };
  /** Rows cleared on the last lock, for the flash effect. */
  cleared: number[];
}

/** Spawn-state cells inside each piece's box (y down). */
const SHAPES: Record<PieceType, { size: number; cells: Point[] }> = {
  I: {
    size: 4,
    cells: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ],
  },
  J: {
    size: 3,
    cells: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  L: {
    size: 3,
    cells: [
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  O: {
    size: 4,
    cells: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  S: {
    size: 3,
    cells: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  T: {
    size: 3,
    cells: [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
  Z: {
    size: 3,
    cells: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
  },
};

/**
 * SRS wall-kick tests for clockwise rotation from state `from`, in the
 * guideline's y-up convention (converted when applied).
 */
const KICKS_JLSTZ: Point[][] = [
  [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ], // 0→R
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ], // R→2
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ], // 2→L
  [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ], // L→0
];
const KICKS_I: Point[][] = [
  [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
  ], // 0→R
  [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 2 },
    { x: 2, y: -1 },
  ], // R→2
  [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 1 },
    { x: -1, y: -2 },
  ], // 2→L
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: -2 },
    { x: -2, y: 1 },
  ], // L→0
];

/** Board cells covered by a piece. Rotating clockwise in an n×n box maps (x, y) → (n−1−y, x). */
export function cellsOf(p: Piece): Point[] {
  const { size, cells } = SHAPES[p.type];
  const turns = p.type === 'O' ? 0 : ((p.rot % 4) + 4) % 4;
  return cells.map((c) => {
    let { x, y } = c;
    for (let i = 0; i < turns; i++) [x, y] = [size - 1 - y, x];
    return { x: p.x + x, y: p.y + y };
  });
}

export function fits(board: Cell[][], p: Piece): boolean {
  return cellsOf(p).every(
    (c) => c.x >= 0 && c.x < COLS && c.y >= 0 && c.y < ROWS && board[c.y]?.[c.x] === null,
  );
}

/** Seconds per row from the Tetris guideline, converted to fixed steps. */
export function gravityInterval(level: number): number {
  const seconds = Math.pow(0.8 - (level - 1) * 0.007, level - 1);
  return Math.max(1, Math.round(seconds * 60));
}

export function dropDistance(s: TetrisState): number {
  let d = 0;
  while (fits(s.board, { ...s.piece, y: s.piece.y + d + 1 })) d++;
  return d;
}

function refill(queue: PieceType[], rng: Rng): void {
  while (queue.length < 7) queue.push(...rng.shuffle(PIECE_TYPES));
}

function spawn(s: TetrisState, rng: Rng): void {
  refill(s.queue, rng);
  const type = s.queue.shift() ?? 'T';
  refill(s.queue, rng);
  s.piece = { type, rot: 0, x: SPAWN_X, y: SPAWN_Y };
  s.gravityCounter = 0;
  s.lockCounter = 0;
  s.lockResets = 0;
  s.lowestY = s.piece.y;
  if (!fits(s.board, s.piece)) {
    s.status = 'over';
    s.events.push('over');
  }
}

export function createTetris(rng: Rng): TetrisState {
  const s: TetrisState = {
    board: Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null)),
    piece: { type: 'T', rot: 0, x: SPAWN_X, y: SPAWN_Y },
    queue: [],
    lines: 0,
    level: 1,
    gravityCounter: 0,
    lockCounter: 0,
    lockResets: 0,
    lowestY: SPAWN_Y,
    das: { dir: null, counter: 0 },
    cleared: [],
    score: 0,
    status: 'playing',
    events: [],
  };
  spawn(s, rng);
  return s;
}

/**
 * A successful move/rotation on the ground buys more time, up to a limit. Moves
 * in the air don't count, and reaching a new lowest row refills the budget.
 */
function onMoved(s: TetrisState): void {
  if (fits(s.board, { ...s.piece, y: s.piece.y + 1 })) return;
  if (s.lockResets < MAX_LOCK_RESETS) {
    s.lockCounter = 0;
    s.lockResets += 1;
  }
}

function shift(s: TetrisState, dx: number): boolean {
  const moved = { ...s.piece, x: s.piece.x + dx };
  if (!fits(s.board, moved)) return false;
  s.piece = moved;
  onMoved(s);
  return true;
}

function rotate(s: TetrisState): void {
  if (s.piece.type === 'O') return;
  const from = s.piece.rot;
  const table = s.piece.type === 'I' ? KICKS_I : KICKS_JLSTZ;
  for (const k of table[from] ?? []) {
    const candidate = { ...s.piece, rot: (from + 1) % 4, x: s.piece.x + k.x, y: s.piece.y - k.y };
    if (fits(s.board, candidate)) {
      s.piece = candidate;
      s.events.push('rotate');
      onMoved(s);
      return;
    }
  }
}

function lock(s: TetrisState, rng: Rng): void {
  const cells = cellsOf(s.piece);
  for (const c of cells) {
    const row = s.board[c.y];
    if (row) row[c.x] = s.piece.type;
  }
  s.events.push('lock');

  // Lock out: a piece that settles entirely inside the hidden rows ends the game.
  if (cells.every((c) => c.y < HIDDEN_ROWS)) {
    s.status = 'over';
    s.events.push('over');
    return;
  }

  const full: number[] = [];
  s.board.forEach((row, y) => {
    if (row.every((c) => c !== null)) full.push(y);
  });
  s.cleared = full;
  if (full.length > 0) {
    s.board = s.board.filter((_, y) => !full.includes(y));
    while (s.board.length < ROWS) s.board.unshift(Array<Cell>(COLS).fill(null));
    s.score += (LINE_POINTS[full.length] ?? 0) * s.level;
    s.lines += full.length;
    s.events.push(full.length === 4 ? 'tetris' : 'clear');
    const level = 1 + Math.floor(s.lines / 10);
    if (level > s.level) {
      s.level = level;
      s.events.push('level');
    }
  }
  spawn(s, rng);
}

function handleHorizontal(s: TetrisState, input: InputFrame): void {
  for (const dir of ['left', 'right'] as const) {
    if (input.pressed.has(dir)) {
      shift(s, dir === 'left' ? -1 : 1);
      s.das = { dir, counter: 0 };
    }
  }
  const { dir } = s.das;
  if (dir === null || !input.held.has(dir)) {
    s.das = { dir: null, counter: 0 };
    return;
  }
  if (input.pressed.has(dir)) return;
  s.das.counter += 1;
  if (s.das.counter >= DAS && (s.das.counter - DAS) % ARR === 0) shift(s, dir === 'left' ? -1 : 1);
}

export function updateTetris(s: TetrisState, input: InputFrame, rng: Rng): void {
  s.events = [];
  s.cleared = [];
  if (s.status !== 'playing') return;

  handleHorizontal(s, input);
  if (input.pressed.has('up')) rotate(s);

  if (input.pressed.has('action')) {
    const d = dropDistance(s);
    s.piece = { ...s.piece, y: s.piece.y + d };
    s.score += d * 2;
    lock(s, rng);
    return;
  }

  const grounded = !fits(s.board, { ...s.piece, y: s.piece.y + 1 });
  if (grounded) {
    s.gravityCounter = 0;
    s.lockCounter += 1;
    if (s.lockCounter >= LOCK_DELAY) lock(s, rng);
    return;
  }

  const softDrop = input.held.has('down');
  const interval = softDrop
    ? Math.min(SOFT_DROP_INTERVAL, gravityInterval(s.level))
    : gravityInterval(s.level);
  s.gravityCounter += 1;
  if (s.gravityCounter >= interval) {
    s.gravityCounter = 0;
    s.piece = { ...s.piece, y: s.piece.y + 1 };
    if (softDrop) s.score += 1;
    if (s.piece.y > s.lowestY) {
      s.lowestY = s.piece.y;
      s.lockResets = 0;
    }
    // Falling to a new row starts a fresh lock timer.
    s.lockCounter = 0;
  }
}

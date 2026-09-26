import type { InputFrame } from '../../engine/input';
import type { Rng } from '../../engine/rng';
import type { BaseState } from '../types';

export const WIDTH = 480;
export const HEIGHT = 600;
export const BASE_SPEED = 5; // px per fixed step = 300 px/s
export const MAX_SPEED = 10;
const SPEEDUP_PER_BRICK = 0.04;
const PADDLE_SPEED = 8;
const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;

const COLS = 10;
const ROWS = 6;
const BRICK_H = 18;
const GAP = 4;
const TOP = 72;
/** Top rows are worth more, like the original. */
const ROW_POINTS = [70, 70, 40, 40, 10, 10];

export interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  alive: boolean;
  points: number;
  row: number;
}

export interface BreakoutState extends BaseState {
  paddle: { x: number; y: number; w: number; h: number };
  ball: { x: number; y: number; vx: number; vy: number; r: number };
  speed: number;
  /** Ball resting on the paddle, waiting for launch. */
  stuck: boolean;
  bricks: Brick[];
  lives: number;
  level: number;
}

function makeBricks(): Brick[] {
  const w = (WIDTH - GAP * (COLS + 1)) / COLS;
  const bricks: Brick[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      bricks.push({
        x: GAP + col * (w + GAP),
        y: TOP + row * (BRICK_H + GAP),
        w,
        h: BRICK_H,
        alive: true,
        points: ROW_POINTS[row] ?? 10,
        row,
      });
    }
  }
  return bricks;
}

const levelSpeed = (level: number): number => Math.min(MAX_SPEED, BASE_SPEED + (level - 1) * 0.5);

function serve(s: BreakoutState): void {
  s.stuck = true;
  s.ball.vx = 0;
  s.ball.vy = 0;
  s.ball.x = s.paddle.x;
  s.ball.y = s.paddle.y - s.ball.r - 1;
}

export function createBreakout(): BreakoutState {
  const paddle = { x: WIDTH / 2, y: HEIGHT - 48, w: 84, h: 12 };
  const s: BreakoutState = {
    paddle,
    ball: { x: 0, y: 0, vx: 0, vy: 0, r: 6 },
    speed: BASE_SPEED,
    stuck: true,
    bricks: makeBricks(),
    lives: 3,
    level: 1,
    score: 0,
    status: 'playing',
    events: [],
  };
  serve(s);
  return s;
}

function setSpeed(s: BreakoutState, speed: number): void {
  const current = Math.hypot(s.ball.vx, s.ball.vy);
  s.speed = Math.min(MAX_SPEED, speed);
  if (current > 0) {
    s.ball.vx *= s.speed / current;
    s.ball.vy *= s.speed / current;
  }
}

function movePaddle(s: BreakoutState, input: InputFrame): void {
  const p = s.paddle;
  if (input.pointerX !== null) {
    p.x = input.pointerX * WIDTH;
  } else {
    if (input.held.has('left')) p.x -= PADDLE_SPEED;
    if (input.held.has('right')) p.x += PADDLE_SPEED;
  }
  p.x = Math.min(WIDTH - p.w / 2, Math.max(p.w / 2, p.x));
}

/** Circle vs. rectangle; resolves along the axis of least penetration. Returns true on hit. */
function collideBrick(s: BreakoutState, b: Brick): boolean {
  const { ball } = s;
  const cx = Math.max(b.x, Math.min(ball.x, b.x + b.w));
  const cy = Math.max(b.y, Math.min(ball.y, b.y + b.h));
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  if (dx * dx + dy * dy >= ball.r * ball.r) return false;

  const penLeft = ball.x + ball.r - b.x;
  const penRight = b.x + b.w - (ball.x - ball.r);
  const penTop = ball.y + ball.r - b.y;
  const penBottom = b.y + b.h - (ball.y - ball.r);
  const minX = Math.min(penLeft, penRight);
  const minY = Math.min(penTop, penBottom);
  if (minX < minY) {
    ball.vx = penLeft < penRight ? -Math.abs(ball.vx) : Math.abs(ball.vx);
    ball.x += penLeft < penRight ? -penLeft : penRight;
  } else {
    ball.vy = penTop < penBottom ? -Math.abs(ball.vy) : Math.abs(ball.vy);
    ball.y += penTop < penBottom ? -penTop : penBottom;
  }
  return true;
}

function hitPaddle(s: BreakoutState, prevY: number): boolean {
  const { ball, paddle: p } = s;
  if (ball.vy <= 0) return false;
  // Only a ball coming from above counts; one already past the top edge is lost.
  if (prevY + ball.r > p.y) return false;
  const halfW = p.w / 2;
  if (ball.y + ball.r < p.y || ball.y - ball.r > p.y + p.h) return false;
  if (ball.x < p.x - halfW - ball.r || ball.x > p.x + halfW + ball.r) return false;
  // Where on the paddle it landed decides the angle: centre = straight up.
  const offset = Math.max(-1, Math.min(1, (ball.x - p.x) / halfW));
  const angle = offset * MAX_BOUNCE_ANGLE;
  ball.vx = s.speed * Math.sin(angle);
  ball.vy = -s.speed * Math.cos(angle);
  ball.y = p.y - ball.r;
  return true;
}

function substep(s: BreakoutState, fraction: number): 'ok' | 'lost' | 'cleared' {
  const { ball } = s;
  const prevY = ball.y;
  ball.x += ball.vx * fraction;
  ball.y += ball.vy * fraction;

  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    s.events.push('bounce');
  } else if (ball.x + ball.r > WIDTH) {
    ball.x = WIDTH - ball.r;
    ball.vx = -Math.abs(ball.vx);
    s.events.push('bounce');
  }
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    s.events.push('bounce');
  }

  if (hitPaddle(s, prevY)) s.events.push('bounce');

  // At most one brick per substep keeps the reflection unambiguous.
  for (const b of s.bricks) {
    if (!b.alive || !collideBrick(s, b)) continue;
    b.alive = false;
    s.score += b.points;
    s.events.push('brick');
    setSpeed(s, s.speed + SPEEDUP_PER_BRICK);
    if (s.bricks.every((x) => !x.alive)) return 'cleared';
    break;
  }

  if (ball.y - ball.r > HEIGHT) return 'lost';
  return 'ok';
}

export function updateBreakout(s: BreakoutState, input: InputFrame, rng: Rng): void {
  s.events = [];
  if (s.status !== 'playing') return;
  movePaddle(s, input);

  if (s.stuck) {
    s.ball.x = s.paddle.x;
    s.ball.y = s.paddle.y - s.ball.r - 1;
    if (input.pressed.has('action') || input.pressed.has('up')) {
      const angle = (rng.next() - 0.5) * (Math.PI / 3); // ±30° from vertical
      s.ball.vx = s.speed * Math.sin(angle);
      s.ball.vy = -s.speed * Math.cos(angle);
      s.stuck = false;
    }
    return;
  }

  // Move in slices no longer than half the radius so a fast ball can't skip a brick.
  const slices = Math.max(1, Math.ceil(s.speed / (s.ball.r / 2)));
  for (let i = 0; i < slices; i++) {
    const result = substep(s, 1 / slices);
    if (result === 'cleared') {
      s.level += 1;
      s.bricks = makeBricks();
      s.speed = levelSpeed(s.level);
      s.events.push('level');
      serve(s);
      return;
    }
    if (result === 'lost') {
      s.lives -= 1;
      if (s.lives <= 0) {
        s.status = 'over';
        s.events.push('over');
        return;
      }
      s.events.push('lose-life');
      s.speed = levelSpeed(s.level);
      serve(s);
      return;
    }
  }
}

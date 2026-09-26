import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng';
import {
  HEIGHT,
  MAX_SPEED,
  WIDTH,
  createBreakout,
  updateBreakout,
  type BreakoutState,
} from '../../src/games/breakout/logic';
import { frame, idle } from '../helpers';

const rng = () => createRng(5);
/** A brick out of reach, so breaking the one under test doesn't clear the level. */
const SPARE = { x: -100, y: -100, w: 1, h: 1, alive: true, points: 10, row: 0 };
const speedOf = (s: BreakoutState) => Math.hypot(s.ball.vx, s.ball.vy);

/** A launched ball with no bricks in the way. */
function freeBall(s: BreakoutState, x: number, y: number, vx: number, vy: number): void {
  s.stuck = false;
  s.bricks = [{ x: -100, y: -100, w: 1, h: 1, alive: true, points: 10, row: 0 }];
  Object.assign(s.ball, { x, y, vx, vy });
}

describe('breakout', () => {
  it('starts with 3 lives, a full wall of bricks and the ball on the paddle', () => {
    const s = createBreakout();
    expect(s.lives).toBe(3);
    expect(s.bricks.length).toBeGreaterThanOrEqual(40);
    expect(s.stuck).toBe(true);
    expect(s.ball.y).toBeLessThan(s.paddle.y);
  });

  it('keeps the ball on the paddle until launched', () => {
    const s = createBreakout();
    for (let i = 0; i < 10; i++) updateBreakout(s, frame([], ['right']), rng());
    expect(s.ball.x).toBeCloseTo(s.paddle.x, 5);
    expect(s.stuck).toBe(true);
    updateBreakout(s, frame(['action']), rng());
    expect(s.stuck).toBe(false);
    expect(s.ball.vy).toBeLessThan(0);
  });

  it('moves the paddle with held keys and clamps it to the field', () => {
    const s = createBreakout();
    const x0 = s.paddle.x;
    updateBreakout(s, frame([], ['left']), rng());
    expect(s.paddle.x).toBeLessThan(x0);
    for (let i = 0; i < 500; i++) updateBreakout(s, frame([], ['left']), rng());
    expect(s.paddle.x - s.paddle.w / 2).toBeGreaterThanOrEqual(0);
  });

  it('follows a pointer / touch target', () => {
    const s = createBreakout();
    updateBreakout(s, frame([], [], 0.75), rng());
    expect(s.paddle.x).toBeCloseTo(WIDTH * 0.75, 0);
  });

  it('bounces off the side and top walls', () => {
    const s = createBreakout();
    freeBall(s, WIDTH - 8, 300, 4, -1);
    updateBreakout(s, idle(), rng());
    expect(s.ball.vx).toBeLessThan(0);
    freeBall(s, 200, 8, 1, -4);
    updateBreakout(s, idle(), rng());
    expect(s.ball.vy).toBeGreaterThan(0);
  });

  it('sends the ball straight up from the paddle centre and sideways from the edges', () => {
    const s = createBreakout();
    freeBall(s, s.paddle.x, s.paddle.y - 7, 0, 5);
    updateBreakout(s, idle(), rng());
    expect(s.ball.vy).toBeLessThan(0);
    expect(Math.abs(s.ball.vx)).toBeLessThan(0.5);

    const t = createBreakout();
    freeBall(t, t.paddle.x + t.paddle.w / 2 - 2, t.paddle.y - 7, 0, 5);
    updateBreakout(t, idle(), rng());
    expect(t.ball.vy).toBeLessThan(0);
    expect(t.ball.vx).toBeGreaterThan(2);
  });

  it('keeps speed constant through a paddle bounce', () => {
    const s = createBreakout();
    freeBall(s, s.paddle.x + 20, s.paddle.y - 7, 3, 4);
    const before = speedOf(s);
    updateBreakout(s, idle(), rng());
    expect(speedOf(s)).toBeCloseTo(before, 5);
  });

  it('breaks a brick: removes it, scores, and bounces', () => {
    const s = createBreakout();
    s.stuck = false;
    s.bricks = [{ x: 100, y: 100, w: 40, h: 16, alive: true, points: 70, row: 0 }, SPARE];
    Object.assign(s.ball, { x: 120, y: 125, vx: 0, vy: -5 });
    updateBreakout(s, idle(), rng());
    expect(s.bricks[0]!.alive).toBe(false);
    expect(s.score).toBe(70);
    expect(s.ball.vy).toBeGreaterThan(0);
    expect(s.events).toContain('brick');
  });

  it('reflects horizontally when hitting a brick side', () => {
    const s = createBreakout();
    s.stuck = false;
    s.bricks = [
      { x: 100, y: 100, w: 40, h: 16, alive: true, points: 10, row: 0 },
      { x: 400, y: 400, w: 1, h: 1, alive: true, points: 10, row: 0 },
    ];
    Object.assign(s.ball, { x: 90, y: 108, vx: 5, vy: 0.1 });
    updateBreakout(s, idle(), rng());
    expect(s.bricks[0]!.alive).toBe(false);
    expect(s.ball.vx).toBeLessThan(0);
  });

  it('does not tunnel through a brick at max speed', () => {
    const s = createBreakout();
    s.stuck = false;
    s.bricks = [{ x: 0, y: 200, w: WIDTH, h: 4, alive: true, points: 10, row: 0 }, SPARE];
    Object.assign(s.ball, { x: 200, y: 215, vx: 0, vy: -MAX_SPEED });
    for (let i = 0; i < 5; i++) updateBreakout(s, idle(), rng());
    expect(s.bricks[0]!.alive).toBe(false);
    expect(s.ball.y).toBeGreaterThan(200);
  });

  it('loses a life when the ball falls out, then re-serves', () => {
    const s = createBreakout();
    freeBall(s, 30, HEIGHT - 2, 0, 5);
    s.paddle.x = WIDTH - 50;
    for (let i = 0; i < 5; i++) updateBreakout(s, idle(), rng());
    expect(s.lives).toBe(2);
    expect(s.stuck).toBe(true);
    expect(s.events.length === 0 || s.status === 'playing').toBe(true);
  });

  it('ends the game on the last life', () => {
    const s = createBreakout();
    s.lives = 1;
    freeBall(s, 30, HEIGHT - 2, 0, 5);
    s.paddle.x = WIDTH - 50;
    for (let i = 0; i < 5; i++) updateBreakout(s, idle(), rng());
    expect(s.status).toBe('over');
  });

  it('clearing the wall goes to the next level with a fresh wall', () => {
    const s = createBreakout();
    s.stuck = false;
    s.bricks = [{ x: 100, y: 100, w: 40, h: 16, alive: true, points: 10, row: 0 }];
    Object.assign(s.ball, { x: 120, y: 125, vx: 0, vy: -5 });
    updateBreakout(s, idle(), rng());
    expect(s.level).toBe(2);
    expect(s.bricks.filter((b) => b.alive).length).toBeGreaterThanOrEqual(40);
    expect(s.stuck).toBe(true);
    expect(s.events).toContain('level');
  });

  it('never exceeds the speed cap', () => {
    const s = createBreakout();
    updateBreakout(s, frame(['action']), rng());
    for (let i = 0; i < 5000 && s.status === 'playing'; i++) {
      s.paddle.x = s.ball.x; // perfect player
      updateBreakout(s, idle(), rng());
      expect(speedOf(s)).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
    }
    expect(s.score).toBeGreaterThan(0);
  });

  it('does not rescue a ball that clips the paddle side below its top edge', () => {
    const s = createBreakout();
    const p = s.paddle;
    freeBall(s, p.x - p.w / 2 - 4, p.y + 8, 0.5, 3);
    updateBreakout(s, idle(), rng());
    expect(s.ball.vy).toBeGreaterThan(0);
  });
});

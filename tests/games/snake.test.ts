import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng';
import {
  BASE_INTERVAL,
  MIN_INTERVAL,
  createSnake,
  updateSnake,
  type SnakeState,
} from '../../src/games/snake/logic';
import { frame, idle } from '../helpers';

const rng = () => createRng(1);

/** Run steps until the snake has moved once. */
function tick(s: SnakeState, input = idle()): void {
  const r = rng();
  updateSnake(s, input, r);
  let guard = 0;
  while (s.sinceMove !== 0 && guard++ < 100) updateSnake(s, idle(), r);
}

describe('snake', () => {
  it('starts in the middle, 3 long, heading right, with food off the body', () => {
    const s = createSnake(rng());
    expect(s.body).toHaveLength(3);
    expect(s.dir).toEqual({ x: 1, y: 0 });
    expect(s.body.some((c) => c.x === s.food.x && c.y === s.food.y)).toBe(false);
    expect(s.status).toBe('playing');
  });

  it('moves one cell per interval, not per step', () => {
    const s = createSnake(rng());
    const head = { ...s.body[0]! };
    for (let i = 0; i < BASE_INTERVAL - 1; i++) updateSnake(s, idle(), rng());
    expect(s.body[0]).toEqual(head);
    updateSnake(s, idle(), rng());
    expect(s.body[0]).toEqual({ x: head.x + 1, y: head.y });
  });

  it('turns on input', () => {
    const s = createSnake(rng());
    const head = { ...s.body[0]! };
    tick(s, frame(['up']));
    expect(s.body[0]).toEqual({ x: head.x, y: head.y - 1 });
  });

  it('ignores a 180° reversal', () => {
    const s = createSnake(rng());
    const head = { ...s.body[0]! };
    tick(s, frame(['left']));
    expect(s.body[0]).toEqual({ x: head.x + 1, y: head.y });
    expect(s.status).toBe('playing');
  });

  it('queues two quick turns inside one interval instead of dying', () => {
    const s = createSnake(rng());
    const head = { ...s.body[0]! };
    // up then left within the same interval: a naive implementation would
    // apply "left" against the current "right" and ignore it, or reverse into itself.
    updateSnake(s, frame(['up', 'left']), rng());
    tick(s);
    expect(s.body[0]).toEqual({ x: head.x, y: head.y - 1 });
    tick(s);
    expect(s.body[0]).toEqual({ x: head.x - 1, y: head.y - 1 });
    expect(s.status).toBe('playing');
  });

  it('dies on the wall', () => {
    const s = createSnake(rng(), { cols: 6, rows: 6 });
    for (let i = 0; i < 10 && s.status === 'playing'; i++) tick(s);
    expect(s.status).toBe('over');
    expect(s.events).toContain('over');
  });

  it('dies when biting itself', () => {
    const s = createSnake(rng(), { cols: 10, rows: 10 });
    s.body = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ];
    s.dir = { x: 1, y: 0 };
    s.food = { x: 0, y: 0 };
    tick(s, frame(['down'])); // into (5,6), which is body, not the tail
    expect(s.status).toBe('over');
  });

  it('may move into the cell the tail is leaving', () => {
    const s = createSnake(rng(), { cols: 10, rows: 10 });
    s.body = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ];
    s.dir = { x: 0, y: -1 };
    s.food = { x: 0, y: 0 };
    tick(s, frame(['right'])); // head goes to (6,5) as the tail leaves it
    expect(s.status).toBe('playing');
    expect(s.body[0]).toEqual({ x: 6, y: 5 });
  });

  it('eats: grows by one, scores, and respawns food on a free cell', () => {
    const s = createSnake(rng());
    const head = s.body[0]!;
    s.food = { x: head.x + 1, y: head.y };
    const len = s.body.length;
    tick(s);
    expect(s.score).toBe(10);
    expect(s.events).toContain('eat');
    tick(s);
    expect(s.body).toHaveLength(len + 1);
    expect(s.body.some((c) => c.x === s.food.x && c.y === s.food.y)).toBe(false);
  });

  it('speeds up as it eats, down to a floor', () => {
    const s = createSnake(rng(), { cols: 40, rows: 3 });
    s.body = [{ x: 1, y: 1 }];
    s.dir = { x: 1, y: 0 };
    for (let i = 0; i < 30; i++) {
      s.food = { x: s.body[0]!.x + 1, y: 1 };
      tick(s);
    }
    expect(s.interval).toBeLessThan(BASE_INTERVAL);
    expect(s.interval).toBeGreaterThanOrEqual(MIN_INTERVAL);
  });

  it('wins when the board is full', () => {
    const s = createSnake(rng(), { cols: 3, rows: 1 });
    s.body = [
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ];
    s.dir = { x: 1, y: 0 };
    s.food = { x: 2, y: 0 };
    tick(s);
    expect(s.status).toBe('won');
  });

  it('does nothing once the game is over', () => {
    const s = createSnake(rng());
    s.status = 'over';
    const body = JSON.stringify(s.body);
    for (let i = 0; i < 50; i++) updateSnake(s, frame(['up']), rng());
    expect(JSON.stringify(s.body)).toBe(body);
  });
});

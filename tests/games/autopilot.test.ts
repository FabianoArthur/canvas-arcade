import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/engine/rng';
import { createSnake, updateSnake } from '../../src/games/snake/logic';
import { snakePilot } from '../../src/games/snake/autopilot';
import { createBreakout, updateBreakout } from '../../src/games/breakout/logic';
import { breakoutPilot } from '../../src/games/breakout/autopilot';
import { createTetris, updateTetris } from '../../src/games/tetris/logic';
import { tetrisPilot } from '../../src/games/tetris/autopilot';

describe('autopilots (demo mode)', () => {
  it('snake pilot eats and survives for a long run', () => {
    const rng = createRng(21);
    const s = createSnake(rng);
    const pilot = snakePilot();
    for (let i = 0; i < 6000 && s.status === 'playing'; i++) updateSnake(s, pilot(s), rng);
    expect(s.score).toBeGreaterThanOrEqual(150);
  });

  it('breakout pilot keeps the ball in play and breaks bricks', () => {
    const rng = createRng(4);
    const s = createBreakout();
    const pilot = breakoutPilot();
    for (let i = 0; i < 4000 && s.status === 'playing'; i++) updateBreakout(s, pilot(s), rng);
    expect(s.lives).toBe(3);
    expect(s.score).toBeGreaterThan(300);
  });

  it('tetris pilot clears lines without topping out', () => {
    const rng = createRng(8);
    const s = createTetris(rng);
    const pilot = tetrisPilot();
    for (let i = 0; i < 12000 && s.status === 'playing'; i++) updateTetris(s, pilot(s), rng);
    expect(s.lines).toBeGreaterThanOrEqual(100);
  });
});

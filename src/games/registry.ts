import type { GameDefinition } from './types';
import { snakePilot } from './snake/autopilot';
import { breakoutPilot } from './breakout/autopilot';
import { tetrisPilot } from './tetris/autopilot';
import { createSnake, updateSnake, type SnakeState } from './snake/logic';
import { CELL as SNAKE_CELL, renderSnake } from './snake/render';
import {
  HEIGHT,
  WIDTH,
  createBreakout,
  updateBreakout,
  type BreakoutState,
} from './breakout/logic';
import { renderBreakout } from './breakout/render';
import { createTetris, updateTetris, type TetrisState } from './tetris/logic';
import { BOARD_H, BOARD_W, SIDE_W, renderTetris } from './tetris/render';

const snake: GameDefinition<SnakeState> = {
  id: 'snake',
  title: 'Snake',
  tagline: 'Eat, grow, don’t bite yourself. It speeds up.',
  width: 20 * SNAKE_CELL,
  height: 20 * SNAKE_CELL,
  controls: { keys: 'Arrows / WASD to turn', touch: 'Swipe or use the pad' },
  touch: 'dpad',
  create: (rng) => createSnake(rng),
  update: updateSnake,
  render: renderSnake,
  hud: (s) => `Length ${s.body.length}`,
  pilot: snakePilot,
};

const breakout: GameDefinition<BreakoutState> = {
  id: 'breakout',
  title: 'Breakout',
  tagline: 'Where the ball hits the paddle sets its angle.',
  width: WIDTH,
  height: HEIGHT,
  controls: { keys: '← → / A D to move · Space to launch', touch: 'Drag to move · tap to launch' },
  touch: 'paddle',
  create: () => createBreakout(),
  update: updateBreakout,
  render: renderBreakout,
  hud: (s) => `Lives ${'●'.repeat(Math.max(0, s.lives))} · Level ${s.level}`,
  pilot: breakoutPilot,
};

const tetris: GameDefinition<TetrisState> = {
  id: 'tetris',
  title: 'Tetris',
  tagline: 'SRS rotation with wall kicks, 7-bag, ghost piece.',
  width: BOARD_W + SIDE_W,
  height: BOARD_H,
  controls: {
    keys: '← → move · ↑ rotate · ↓ soft drop · Space hard drop',
    touch: 'Buttons below the board',
  },
  touch: 'tetris',
  create: (rng) => createTetris(rng),
  update: updateTetris,
  render: renderTetris,
  // Level and lines are drawn on the board's side panel.
  hud: () => '',
  pilot: tetrisPilot,
};

// Each definition is only ever used with its own state type.
export const GAMES = [snake, breakout, tetris] as unknown as GameDefinition[];

export const gameById = (id: string): GameDefinition | undefined => GAMES.find((g) => g.id === id);

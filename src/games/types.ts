import type { InputFrame } from '../engine/input';
import type { Rng } from '../engine/rng';

export type Status = 'playing' | 'over' | 'won';

/** Things that happened on a step, for sound and screen effects. Cleared every step. */
export type GameEvent =
  | 'eat'
  | 'bounce'
  | 'brick'
  | 'lose-life'
  | 'rotate'
  | 'lock'
  | 'clear'
  | 'tetris'
  | 'level'
  | 'over'
  | 'won';

export interface BaseState {
  score: number;
  status: Status;
  events: GameEvent[];
}

export interface Palette {
  dark: boolean;
  bg: string;
  grid: string;
  fg: string;
  muted: string;
  accent: string;
  danger: string;
}

export interface GameDefinition<S extends BaseState = BaseState> {
  id: string;
  title: string;
  tagline: string;
  /** Logical canvas size; the shell scales it to fit. */
  width: number;
  height: number;
  controls: { keys: string; touch: string };
  /** Which on-screen touch buttons to show. */
  touch: 'dpad' | 'paddle' | 'tetris';
  create(rng: Rng): S;
  update(state: S, input: InputFrame, rng: Rng): void;
  render(ctx: CanvasRenderingContext2D, state: S, palette: Palette, reducedMotion: boolean): void;
  /** Extra HUD stat, e.g. lives or level. */
  hud(state: S): string;
  /** A scripted player for demo mode; one instance per session. */
  pilot(): (state: S) => InputFrame;
}

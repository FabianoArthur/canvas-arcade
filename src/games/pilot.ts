import type { Action, InputFrame } from '../engine/input';

/** Build an InputFrame the way the InputBuffer would, for scripted players. */
export function pilotFrame(pressed: Action[] = [], held: Action[] = []): InputFrame {
  return { pressed: new Set(pressed), order: pressed, held: new Set(held), pointerX: null };
}

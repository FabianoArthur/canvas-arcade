import type { Action, InputFrame } from '../src/engine/input';

export function frame(
  pressed: Action[] = [],
  held: Action[] = [],
  pointerX: number | null = null,
): InputFrame {
  return { pressed: new Set(pressed), order: pressed, held: new Set(held), pointerX };
}

export const idle = (): InputFrame => frame();

export type Action = 'left' | 'right' | 'up' | 'down' | 'action' | 'pause';

/** What the game sees on one fixed step. */
export interface InputFrame {
  /** Actions newly pressed since the previous step (each reported once). */
  pressed: ReadonlySet<Action>;
  /** Presses in the order they happened — Snake needs this for quick turns. */
  order: readonly Action[];
  /** Actions currently held down. */
  held: ReadonlySet<Action>;
  /** Pointer/touch target across the play field, 0..1, or null when not dragging. */
  pointerX: number | null;
}

const KEYMAP: Record<string, Action> = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  Space: 'action',
  Enter: 'action',
  KeyP: 'pause',
  Escape: 'pause',
};

export function keyToAction(code: string): Action | null {
  return KEYMAP[code] ?? null;
}

/**
 * Collects key/touch events between fixed steps. `frame()` is called once per
 * step and consumes the pending presses, so a tap is never lost (released before
 * the step ran) nor doubled (several render frames per step).
 */
export class InputBuffer {
  private held = new Set<Action>();
  private pending: Action[] = [];
  private pointer: number | null = null;

  press(action: Action): void {
    if (this.held.has(action)) return; // OS key-repeat
    this.held.add(action);
    this.pending.push(action);
  }

  release(action: Action): void {
    this.held.delete(action);
  }

  setPointerX(x: number | null): void {
    this.pointer = x;
  }

  clear(): void {
    this.held.clear();
    this.pending = [];
    this.pointer = null;
  }

  frame(): InputFrame {
    const order = this.pending;
    this.pending = [];
    return {
      pressed: new Set(order),
      order,
      held: new Set(this.held),
      pointerX: this.pointer,
    };
  }
}

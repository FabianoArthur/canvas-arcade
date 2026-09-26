import { describe, expect, it } from 'vitest';
import { InputBuffer, keyToAction } from '../../src/engine/input';

describe('keyToAction', () => {
  it('maps arrows and WASD', () => {
    expect(keyToAction('ArrowLeft')).toBe('left');
    expect(keyToAction('KeyA')).toBe('left');
    expect(keyToAction('ArrowUp')).toBe('up');
    expect(keyToAction('KeyW')).toBe('up');
    expect(keyToAction('ArrowDown')).toBe('down');
    expect(keyToAction('KeyD')).toBe('right');
  });

  it('maps space to action and P / Escape to pause', () => {
    expect(keyToAction('Space')).toBe('action');
    expect(keyToAction('KeyP')).toBe('pause');
    expect(keyToAction('Escape')).toBe('pause');
  });

  it('returns null for unmapped keys', () => {
    expect(keyToAction('KeyZ')).toBeNull();
  });
});

describe('InputBuffer', () => {
  it('reports a press exactly once, on the next step', () => {
    const b = new InputBuffer();
    b.press('left');
    expect(b.frame().pressed.has('left')).toBe(true);
    expect(b.frame().pressed.has('left')).toBe(false);
  });

  it('keeps held state until release', () => {
    const b = new InputBuffer();
    b.press('right');
    b.frame();
    expect(b.frame().held.has('right')).toBe(true);
    b.release('right');
    expect(b.frame().held.has('right')).toBe(false);
  });

  it('does not lose a tap that is released before the step runs', () => {
    const b = new InputBuffer();
    b.press('action');
    b.release('action');
    const f = b.frame();
    expect(f.pressed.has('action')).toBe(true);
    expect(f.held.has('action')).toBe(false);
  });

  it('ignores key-repeat presses while held', () => {
    const b = new InputBuffer();
    b.press('up');
    b.frame();
    b.press('up');
    expect(b.frame().pressed.has('up')).toBe(false);
  });

  it('keeps the order of presses within one step', () => {
    const b = new InputBuffer();
    b.press('up');
    b.release('up');
    b.press('left');
    expect(b.frame().order).toEqual(['up', 'left']);
  });

  it('clear() drops everything', () => {
    const b = new InputBuffer();
    b.press('left');
    b.clear();
    const f = b.frame();
    expect(f.pressed.size).toBe(0);
    expect(f.held.size).toBe(0);
  });

  it('tracks a pointer x target for paddle games', () => {
    const b = new InputBuffer();
    b.setPointerX(0.25);
    expect(b.frame().pointerX).toBe(0.25);
    b.setPointerX(null);
    expect(b.frame().pointerX).toBeNull();
  });
});

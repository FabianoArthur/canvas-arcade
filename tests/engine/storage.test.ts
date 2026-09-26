import { describe, expect, it } from 'vitest';
import { createScoreStore, type KeyValueStore } from '../../src/engine/storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
}

const throwing: KeyValueStore = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('createScoreStore', () => {
  it('starts empty', () => {
    const store = createScoreStore(memoryStore());
    expect(store.top('snake')).toEqual([]);
    expect(store.best('snake')).toBe(0);
  });

  it('keeps the top 5 scores, highest first', () => {
    const store = createScoreStore(memoryStore());
    for (const s of [10, 50, 30, 70, 20, 60, 40]) store.submit('snake', s);
    expect(store.top('snake').map((e) => e.score)).toEqual([70, 60, 50, 40, 30]);
    expect(store.best('snake')).toBe(70);
  });

  it('reports whether a submission is a new best', () => {
    const store = createScoreStore(memoryStore());
    expect(store.submit('tetris', 100).isBest).toBe(true);
    expect(store.submit('tetris', 50).isBest).toBe(false);
    expect(store.submit('tetris', 100).isBest).toBe(false);
    expect(store.submit('tetris', 101).isBest).toBe(true);
  });

  it('ignores zero and invalid scores', () => {
    const store = createScoreStore(memoryStore());
    store.submit('snake', 0);
    store.submit('snake', Number.NaN);
    store.submit('snake', -5);
    expect(store.top('snake')).toEqual([]);
  });

  it('keeps games separate', () => {
    const store = createScoreStore(memoryStore());
    store.submit('snake', 10);
    expect(store.best('breakout')).toBe(0);
  });

  it('persists across instances sharing the backing store', () => {
    const backing = memoryStore();
    createScoreStore(backing).submit('snake', 33);
    expect(createScoreStore(backing).best('snake')).toBe(33);
  });

  it('treats corrupted JSON as empty', () => {
    const store = createScoreStore(memoryStore({ 'canvas-arcade:v1': '{not json' }));
    expect(store.top('snake')).toEqual([]);
    store.submit('snake', 5);
    expect(store.best('snake')).toBe(5);
  });

  it('drops entries with the wrong shape', () => {
    const raw = JSON.stringify({
      scores: { snake: [{ score: 'x' }, { score: 12, at: 1 }, null], breakout: 'nope' },
    });
    const store = createScoreStore(memoryStore({ 'canvas-arcade:v1': raw }));
    expect(store.top('snake').map((e) => e.score)).toEqual([12]);
    expect(store.top('breakout')).toEqual([]);
  });

  it('keeps working in memory when storage throws', () => {
    const store = createScoreStore(throwing);
    expect(store.submit('snake', 8).isBest).toBe(true);
    expect(store.best('snake')).toBe(8);
  });

  it('keeps working when no storage is available at all', () => {
    const store = createScoreStore(null);
    store.submit('snake', 3);
    expect(store.best('snake')).toBe(3);
  });

  it('stores and reads the sound preference', () => {
    const backing = memoryStore();
    const store = createScoreStore(backing);
    expect(store.soundOn()).toBe(false);
    store.setSoundOn(true);
    expect(createScoreStore(backing).soundOn()).toBe(true);
  });
});

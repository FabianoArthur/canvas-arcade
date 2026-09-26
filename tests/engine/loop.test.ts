import { describe, expect, it } from 'vitest';
import { FixedStepper, STEP_MS } from '../../src/engine/loop';

describe('FixedStepper', () => {
  it('runs one update per 1/60 s of elapsed time', () => {
    const s = new FixedStepper();
    expect(s.advance(STEP_MS * 3)).toBe(3);
  });

  it('carries leftover time to the next frame', () => {
    const s = new FixedStepper();
    expect(s.advance(STEP_MS * 0.6)).toBe(0);
    expect(s.advance(STEP_MS * 0.6)).toBe(1);
  });

  it('gives the same number of steps on 60 Hz and 144 Hz displays', () => {
    const at60 = new FixedStepper();
    const at144 = new FixedStepper();
    let n60 = 0;
    let n144 = 0;
    for (let i = 0; i < 60; i++) n60 += at60.advance(1000 / 60);
    for (let i = 0; i < 144; i++) n144 += at144.advance(1000 / 144);
    expect(Math.abs(n60 - n144)).toBeLessThanOrEqual(1);
    expect(n60).toBeGreaterThanOrEqual(59);
  });

  it('clamps huge gaps (tab in background) instead of fast-forwarding', () => {
    const s = new FixedStepper();
    expect(s.advance(10_000)).toBeLessThanOrEqual(15);
  });

  it('ignores negative deltas', () => {
    const s = new FixedStepper();
    expect(s.advance(-50)).toBe(0);
  });

  it('exposes interpolation alpha in [0, 1)', () => {
    const s = new FixedStepper();
    s.advance(STEP_MS * 1.5);
    expect(s.alpha).toBeCloseTo(0.5, 5);
  });
});

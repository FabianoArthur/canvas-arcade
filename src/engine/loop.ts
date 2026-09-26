export const STEP_MS = 1000 / 60;
/** Never simulate more than this per frame — a backgrounded tab must not fast-forward. */
const MAX_FRAME_MS = 250;

/**
 * Fixed-timestep accumulator. Game logic always advances in 1/60 s steps, so it
 * behaves the same on a 60 Hz laptop and a 144 Hz monitor, and tests can drive
 * it without a browser.
 */
export class FixedStepper {
  private acc = 0;

  /** Feed elapsed wall time; returns how many fixed steps to run now. */
  advance(elapsedMs: number): number {
    if (!(elapsedMs > 0)) return 0;
    this.acc += Math.min(elapsedMs, MAX_FRAME_MS);
    // Small epsilon so 3 × (1000/60) counts as 3 steps despite float error.
    const steps = Math.floor((this.acc + 1e-6) / STEP_MS);
    this.acc = Math.max(0, this.acc - steps * STEP_MS);
    return steps;
  }

  /** Fraction of the next step already elapsed, for render interpolation. */
  get alpha(): number {
    return this.acc / STEP_MS;
  }

  reset(): void {
    this.acc = 0;
  }
}

export interface LoopCallbacks {
  step(): void;
  render(alpha: number): void;
}

/** requestAnimationFrame driver around FixedStepper. */
export function startLoop(cb: LoopCallbacks): { stop(): void } {
  const stepper = new FixedStepper();
  let last = performance.now();
  let handle = 0;
  let running = true;
  const frame = (now: number): void => {
    if (!running) return;
    const steps = stepper.advance(now - last);
    last = now;
    for (let i = 0; i < steps; i++) cb.step();
    cb.render(stepper.alpha);
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return {
    stop() {
      running = false;
      cancelAnimationFrame(handle);
    },
  };
}

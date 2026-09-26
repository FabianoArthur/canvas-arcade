import type { GameEvent } from '../games/types';

interface Tone {
  freq: number;
  to?: number;
  ms: number;
  type: OscillatorType;
  delay?: number;
}

/** Tiny synthesised effects — no audio files to download. */
const SOUNDS: Partial<Record<GameEvent, Tone[]>> = {
  eat: [{ freq: 660, to: 880, ms: 70, type: 'square' }],
  bounce: [{ freq: 420, ms: 35, type: 'triangle' }],
  brick: [{ freq: 740, ms: 45, type: 'square' }],
  rotate: [{ freq: 520, ms: 25, type: 'triangle' }],
  lock: [{ freq: 180, ms: 50, type: 'triangle' }],
  clear: [
    { freq: 523, ms: 70, type: 'square' },
    { freq: 784, ms: 90, type: 'square', delay: 70 },
  ],
  tetris: [
    { freq: 523, ms: 70, type: 'square' },
    { freq: 659, ms: 70, type: 'square', delay: 70 },
    { freq: 784, ms: 70, type: 'square', delay: 140 },
    { freq: 1047, ms: 140, type: 'square', delay: 210 },
  ],
  level: [
    { freq: 440, ms: 80, type: 'triangle' },
    { freq: 880, ms: 120, type: 'triangle', delay: 80 },
  ],
  'lose-life': [{ freq: 300, to: 120, ms: 260, type: 'sawtooth' }],
  over: [{ freq: 330, to: 80, ms: 520, type: 'sawtooth' }],
  won: [
    { freq: 784, ms: 90, type: 'square' },
    { freq: 1047, ms: 90, type: 'square', delay: 90 },
    { freq: 1568, ms: 200, type: 'square', delay: 180 },
  ],
};

const VOLUME = 0.05;

export class Sfx {
  private ctx: AudioContext | null = null;
  enabled: boolean;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Browsers only allow audio after a user gesture; call from one. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  play(events: readonly GameEvent[]): void {
    if (!this.enabled || !this.ctx || events.length === 0) return;
    // One sound per step is plenty; later events in the list matter more.
    const event = [...events].reverse().find((e) => SOUNDS[e]);
    if (!event) return;
    const now = this.ctx.currentTime;
    for (const tone of SOUNDS[event] ?? []) this.tone(tone, now);
  }

  private tone(t: Tone, now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const start = now + (t.delay ?? 0) / 1000;
    const end = start + t.ms / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = t.type;
    osc.frequency.setValueAtTime(t.freq, start);
    if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, end);
    gain.gain.setValueAtTime(VOLUME, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(end + 0.02);
  }
}

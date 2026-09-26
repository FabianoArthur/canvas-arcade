/** The subset of the Web Storage API we use, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ScoreEntry {
  score: number;
  /** Epoch ms. */
  at: number;
}

export interface ScoreStore {
  top(game: string): ScoreEntry[];
  best(game: string): number;
  submit(game: string, score: number): { isBest: boolean; rank: number | null };
  soundOn(): boolean;
  setSoundOn(on: boolean): void;
}

interface Saved {
  scores: Record<string, ScoreEntry[]>;
  sound: boolean;
}

const KEY = 'canvas-arcade:v1';
const MAX_ENTRIES = 5;

function isEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.score === 'number' &&
    Number.isFinite(v.score) &&
    v.score > 0 &&
    typeof v.at === 'number' &&
    Number.isFinite(v.at)
  );
}

/** Parse whatever is in storage; anything unexpected is dropped, never thrown. */
function parse(raw: string | null): Saved {
  const empty: Saved = { scores: {}, sound: false };
  if (!raw) return empty;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (typeof data !== 'object' || data === null) return empty;
  const obj = data as Record<string, unknown>;
  const scores: Record<string, ScoreEntry[]> = {};
  if (typeof obj.scores === 'object' && obj.scores !== null) {
    for (const [game, list] of Object.entries(obj.scores as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      scores[game] = list
        .filter(isEntry)
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_ENTRIES);
    }
  }
  return { scores, sound: obj.sound === true };
}

/**
 * High scores + preferences. Storage can be missing, full, or throw on access
 * (private mode, blocked site data) — every access is guarded and the store
 * falls back to memory so the game keeps working.
 */
export function createScoreStore(backing: KeyValueStore | null): ScoreStore {
  let state: Saved;
  try {
    state = parse(backing ? backing.getItem(KEY) : null);
  } catch {
    state = parse(null);
  }

  const save = (): void => {
    if (!backing) return;
    try {
      backing.setItem(KEY, JSON.stringify(state));
    } catch {
      // Keep the in-memory copy; nothing else to do.
    }
  };

  const top = (game: string): ScoreEntry[] => [...(state.scores[game] ?? [])];
  const best = (game: string): number => state.scores[game]?.[0]?.score ?? 0;

  return {
    top,
    best,
    submit(game, score) {
      if (!Number.isFinite(score) || score <= 0) return { isBest: false, rank: null };
      const previousBest = best(game);
      const entry: ScoreEntry = { score: Math.floor(score), at: Date.now() };
      const list = [...top(game), entry].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES);
      state.scores[game] = list;
      save();
      const idx = list.indexOf(entry);
      return { isBest: entry.score > previousBest, rank: idx === -1 ? null : idx + 1 };
    },
    soundOn: () => state.sound,
    setSoundOn(on) {
      state.sound = on;
      save();
    },
  };
}

/** `window.localStorage` can throw just by being read (e.g. blocked cookies). */
export function browserStorage(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

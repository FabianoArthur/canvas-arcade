import type { Palette } from '../games/types';

const ACCENTS: Record<string, { light: string; dark: string }> = {
  snake: { light: '#1a7f37', dark: '#7ee787' },
  breakout: { light: '#bc4c00', dark: '#ffa657' },
  tetris: { light: '#0969da', dark: '#79c0ff' },
};

const darkQuery = (): MediaQueryList | null =>
  typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;

export function isDark(): boolean {
  return darkQuery()?.matches ?? true;
}

export function paletteFor(gameId: string, dark = isDark()): Palette {
  const accent = ACCENTS[gameId] ?? { light: '#14171c', dark: '#e8ecf1' };
  return dark
    ? {
        dark,
        bg: '#0f1218',
        grid: '#161a22',
        fg: '#e8ecf1',
        muted: '#8b93a1',
        accent: accent.dark,
        danger: '#ff7b72',
      }
    : {
        dark,
        bg: '#ffffff',
        grid: '#f0f2f5',
        fg: '#14171c',
        muted: '#5b6472',
        accent: accent.light,
        danger: '#cf222e',
      };
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

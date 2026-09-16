/**
 * Visual tokens for the TUI.
 *
 * Centralised so every view animates and colours identically. Frame sets are
 * chosen to render correctly in the common terminal fonts rather than to be
 * exhaustive.
 */

export const theme = {
  color: {
    accent: '#4ecdc4',
    accentDim: '#2f8a84',
    brand: '#45b7d1',
    warn: '#f4c95d',
    danger: '#ff6b6b',
    success: '#7bd88f',
    muted: 'gray',
    text: 'white',
  },
  symbol: {
    tick: '✓',
    cross: '✗',
    arrow: '›',
    pointer: '❯',
    bullet: '•',
    dot: '·',
    corner: '└',
    tee: '├',
    pipe: '│',
  },
} as const;

/** Braille dot spinner — smooth at ~12fps and monospace-safe. */
export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

/** Fills left-to-right; used while a request is in flight with unknown length. */
export const PULSE_FRAMES = [
  '▰▱▱▱▱',
  '▰▰▱▱▱',
  '▰▰▰▱▱',
  '▰▰▰▰▱',
  '▰▰▰▰▰',
  '▱▰▰▰▰',
  '▱▱▰▰▰',
  '▱▱▱▰▰',
  '▱▱▱▱▰',
  '▱▱▱▱▱',
] as const;

/** Frame interval in ms for the spinner and pulse. */
export const FRAME_INTERVAL_MS = 80;

/** Human-readable elapsed time, e.g. "1.4s" or "1m 02s". */
export function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

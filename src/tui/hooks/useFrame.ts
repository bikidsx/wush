import { useEffect, useRef, useState } from 'react';
import { FRAME_INTERVAL_MS } from '../theme.js';

/**
 * Advances an animation frame counter while `active` is true.
 *
 * The interval is torn down when inactive so a finished view stops re-rendering
 * entirely — an always-on timer is what makes ink UIs feel busy and flicker.
 */
export function useFrame(active: boolean, intervalMs = FRAME_INTERVAL_MS): number {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      setFrame((f) => f + 1);
    }, intervalMs);

    return () => clearInterval(id);
  }, [active, intervalMs]);

  return frame;
}

/** Milliseconds elapsed since `active` became true; freezes when it goes false. */
export function useElapsed(active: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!active) {
      startedAt.current = null;
      return;
    }

    startedAt.current = Date.now();
    setElapsed(0);

    // 100ms is fast enough to read as live without churning the render tree.
    const id = setInterval(() => {
      if (startedAt.current !== null) {
        setElapsed(Date.now() - startedAt.current);
      }
    }, 100);

    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}

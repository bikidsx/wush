/**
 * Detects whether a vendor CLI is available on PATH.
 *
 * Subscription providers delegate to an already-authenticated CLI, so
 * readiness means "the binary exists" rather than "a key is configured".
 * Login state itself is owned by the vendor CLI and is only discoverable by
 * attempting a request, so it is deliberately not probed here.
 */

import { execFile } from 'node:child_process';

const cache = new Map<string, boolean>();

/** Resolves true when `command` is runnable. */
export function isCliAvailable(command: string): Promise<boolean> {
  const cached = cache.get(command);
  if (cached !== undefined) return Promise.resolve(cached);

  return new Promise((resolve) => {
    // `which` avoids executing the tool itself, which could be slow or prompt.
    const probe = process.platform === 'win32' ? 'where' : 'which';

    execFile(probe, [command], { timeout: 3000 }, (error) => {
      const available = !error;
      cache.set(command, available);
      resolve(available);
    });
  });
}

/** Clears the availability cache. Used by tests. */
export function resetCliCache(): void {
  cache.clear();
}

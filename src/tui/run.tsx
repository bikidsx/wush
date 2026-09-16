import React from 'react';
import { render } from 'ink';
import { Frame } from './Frame.js';

/**
 * Renders a TUI view and resolves once it exits.
 *
 * Views communicate their outcome through a callback rather than by reading
 * ink's exit code, so the calling command can report results and set a process
 * exit status after the interface has torn down.
 */
export async function runTui<T>(
  title: string,
  view: (resolve: (value: T) => void) => React.ReactElement
): Promise<T> {
  let settle: (value: T) => void;
  const outcome = new Promise<T>((resolve) => {
    settle = resolve;
  });

  let settled = false;
  const resolveOnce = (value: T) => {
    if (settled) return;
    settled = true;
    settle(value);
  };

  const instance = render(<Frame title={title}>{view(resolveOnce)}</Frame>, {
    // Ink's own Ctrl+C handling would bypass the outcome callback.
    exitOnCtrlC: false,
  });

  await instance.waitUntilExit();
  return outcome;
}

/** True when the terminal can host an interactive full-screen interface. */
export function supportsTui(): boolean {
  // Piped output, CI, and dumb terminals must fall back to plain prompts.
  return Boolean(
    process.stdout.isTTY &&
      process.stdin.isTTY &&
      !process.env.CI &&
      process.env.TERM !== 'dumb'
  );
}

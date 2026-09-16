import { useCallback, useEffect, useRef, useState } from 'react';
import type { FriendlyError } from '../../services/ai/errors.js';
import { friendlyError } from '../../services/ai/friendly.js';
import type { AIResult } from '../../types/index.js';
import type { TaskOptions } from '../../services/ai/tasks.js';

export type TaskPhase = 'idle' | 'running' | 'done' | 'error' | 'cancelled';

export interface AITaskState<T, P> {
  phase: TaskPhase;
  /** Incrementally populated fields while the model streams. */
  partial: P | null;
  result: AIResult<T> | null;
  error: FriendlyError | null;
  /** Starts (or restarts) the task. */
  run: () => void;
  /** Aborts an in-flight request. */
  cancel: () => void;
}

/**
 * Runs an AI task and exposes its progress for rendering.
 *
 * The task receives an abort signal so pressing Esc genuinely stops the request
 * instead of merely hiding the spinner while tokens keep being billed.
 */
export function useAITask<T, P = Partial<T>>(
  task: (options: TaskOptions) => Promise<AIResult<T>>
): AITaskState<T, P> {
  const [phase, setPhase] = useState<TaskPhase>('idle');
  const [partial, setPartial] = useState<P | null>(null);
  const [result, setResult] = useState<AIResult<T> | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  // Guards against setting state after unmount, which ink warns about.
  const mountedRef = useRef(true);
  // Distinguishes a user cancel from a genuine failure.
  const cancelledRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      controllerRef.current?.abort();
    };
  }, []);

  const run = useCallback(() => {
    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;
    cancelledRef.current = false;

    setPhase('running');
    setPartial(null);
    setResult(null);
    setError(null);

    task({
      abortSignal: controller.signal,
      onPartial: (value) => {
        if (mountedRef.current && !controller.signal.aborted) {
          setPartial(value as P);
        }
      },
    })
      .then((value) => {
        if (!mountedRef.current || controller.signal.aborted) return;
        setResult(value);
        setPhase('done');
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        if (cancelledRef.current || controller.signal.aborted) {
          setPhase('cancelled');
          return;
        }
        setError(friendlyError(err));
        setPhase('error');
      });
  }, [task]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    controllerRef.current?.abort();
    if (mountedRef.current) setPhase('cancelled');
  }, []);

  return { phase, partial, result, error, run, cancel };
}

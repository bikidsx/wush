/**
 * Maps raw provider/network failures onto messages a user can act on.
 *
 * The previous implementation surfaced whatever `error.message` the vendor SDK
 * produced, which for an unset key read "401 Incorrect API key provided: sk-..."
 * — technically true, but it never told the user to run `wush config`.
 */

import {
  APICallError,
  InvalidToolInputError,
  NoObjectGeneratedError,
  NoOutputGeneratedError,
} from 'ai';
import { ProviderConfigError } from './model.js';

export interface FriendlyError {
  message: string;
  hint?: string;
  /** Retrying the identical request may succeed (rate limit, transient 5xx). */
  retryable: boolean;
}

export function toFriendlyError(error: unknown, context?: { providerLabel?: string }): FriendlyError {
  const who = context?.providerLabel ?? 'the AI provider';

  if (error instanceof ProviderConfigError) {
    return { message: error.message, hint: error.hint, retryable: false };
  }

  if (NoOutputGeneratedError.isInstance(error)) {
    // Reached only when no more specific stream error was captured.
    return {
      message: `${who} produced no usable output.`,
      hint: 'Try regenerating, or switch to a different model.',
      retryable: true,
    };
  }

  if (NoObjectGeneratedError.isInstance(error)) {
    return {
      message: `${who} returned a response that did not match the expected format.`,
      hint: 'Smaller local models often struggle with structured output. Try a larger model.',
      retryable: true,
    };
  }

  if (InvalidToolInputError.isInstance(error)) {
    return {
      message: `${who} produced malformed structured output.`,
      retryable: true,
    };
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode;

    // A rejected schema is a wush bug, not a user misconfiguration, so say so
    // rather than sending the user to `wush config`.
    if (status === 400 && /invalid[_ ]json[_ ]schema|response_format|text\.format/i.test(
      `${error.message} ${error.responseBody ?? ''}`
    )) {
      return {
        message: `${who} rejected the output schema wush sent.`,
        hint: 'This is a bug in wush, not your configuration. Please report it with the model id.',
        retryable: false,
      };
    }

    if (status === 401 || status === 403) {
      return {
        message: `${who} rejected your credentials.`,
        hint: 'The API key is missing, expired, or lacks access. Run `wush config`.',
        retryable: false,
      };
    }
    if (status === 404) {
      return {
        message: `${who} does not recognise the selected model.`,
        hint: 'Run `wush models` to see what this provider currently offers.',
        retryable: false,
      };
    }
    if (status === 429) {
      return {
        message: `${who} rate-limited the request.`,
        hint: 'Wait a moment, or switch to a provider with more headroom.',
        retryable: true,
      };
    }
    if (status === 402) {
      return {
        message: `${who} reports insufficient credit or quota.`,
        hint: 'Check billing for this provider.',
        retryable: false,
      };
    }
    if (status !== undefined && status >= 500) {
      return {
        message: `${who} had a server error (${status}).`,
        retryable: true,
      };
    }
    return {
      message: `${who} rejected the request: ${error.message}`,
      retryable: error.isRetryable ?? false,
    };
  }

  // Connection-level failures: most often a local server that is not running.
  const code = (error as { code?: string } | undefined)?.code;
  const message = error instanceof Error ? error.message : String(error);

  if (code === 'ECONNREFUSED' || /ECONNREFUSED|fetch failed/i.test(message)) {
    return {
      message: `Could not reach ${who}.`,
      hint: 'If this is a local endpoint, confirm the server is running (e.g. `ollama serve`).',
      retryable: true,
    };
  }
  if (code === 'ENOTFOUND' || /ENOTFOUND/i.test(message)) {
    return {
      message: `Could not resolve the host for ${who}.`,
      hint: 'Check the base URL and your network connection.',
      retryable: false,
    };
  }
  if (code === 'ETIMEDOUT' || /timed? ?out|AbortError/i.test(message)) {
    return {
      message: `${who} took too long to respond.`,
      retryable: true,
    };
  }

  return { message, retryable: false };
}

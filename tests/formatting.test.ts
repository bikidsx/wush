import { describe, expect, test } from 'bun:test';
import { APICallError } from 'ai';
import {
  formatCommitMessage,
  formatPRBody,
  commitMessageSchema,
  prDescriptionSchema,
} from '../src/services/ai/schemas.js';
import { toFriendlyError } from '../src/services/ai/errors.js';
import { ProviderConfigError } from '../src/services/ai/model.js';

describe('commit message formatting', () => {
  test('renders a conventional header', () => {
    expect(
      formatCommitMessage({ type: 'feat', scope: 'auth', subject: 'add token refresh' })
    ).toBe('feat(auth): add token refresh');
  });

  test('omits the scope when absent', () => {
    expect(formatCommitMessage({ type: 'fix', subject: 'correct off-by-one' })).toBe(
      'fix: correct off-by-one'
    );
  });

  test('separates the body with a blank line, as git expects', () => {
    const text = formatCommitMessage({
      type: 'perf',
      subject: 'cache diff parsing',
      body: 'Parsing dominated commit latency.',
    });
    expect(text).toBe('perf: cache diff parsing\n\nParsing dominated commit latency.');
  });

  test('ignores a whitespace-only body', () => {
    expect(formatCommitMessage({ type: 'chore', subject: 'bump deps', body: '   ' })).toBe(
      'chore: bump deps'
    );
  });

  test('rejects a type outside the conventional set', () => {
    expect(commitMessageSchema.safeParse({ type: 'wip', subject: 'x' }).success).toBe(false);
  });
});

describe('PR body formatting', () => {
  test('builds markdown sections from structured fields', () => {
    const body = formatPRBody({
      title: 'Add pull command',
      summary: 'Adds a pull command with safety checks.',
      changes: ['Add pull command', 'Warn on dirty tree'],
      testing: 'Manual run against a dirty tree.',
    });

    expect(body).toContain('## Summary');
    expect(body).toContain('## Changes');
    expect(body).toContain('- Warn on dirty tree');
    expect(body).toContain('## Testing');
    // Optional sections must not appear as empty headings.
    expect(body).not.toContain('## Notes');
  });

  test('requires the fields the PR command consumes', () => {
    const parsed = prDescriptionSchema.safeParse({
      title: 'x',
      summary: 'y',
      changes: ['z'],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('error mapping', () => {
  function apiError(statusCode: number) {
    return new APICallError({
      message: `HTTP ${statusCode}`,
      url: 'https://api.example.com/v1/chat',
      requestBodyValues: {},
      statusCode,
    });
  }

  test('turns 401 into a credentials instruction', () => {
    const friendly = toFriendlyError(apiError(401), { providerLabel: 'OpenAI' });
    expect(friendly.message).toContain('credentials');
    expect(friendly.hint).toContain('wush config');
    expect(friendly.retryable).toBe(false);
  });

  test('marks rate limiting as retryable', () => {
    const friendly = toFriendlyError(apiError(429));
    expect(friendly.retryable).toBe(true);
  });

  test('points 404 at model discovery', () => {
    const friendly = toFriendlyError(apiError(404));
    expect(friendly.hint).toContain('wush models');
  });

  test('treats 5xx as retryable', () => {
    expect(toFriendlyError(apiError(503)).retryable).toBe(true);
  });

  test('suggests starting the local server on connection refused', () => {
    const error = Object.assign(new Error('fetch failed'), { code: 'ECONNREFUSED' });
    const friendly = toFriendlyError(error, { providerLabel: 'Ollama' });
    expect(friendly.message).toContain('Ollama');
    expect(friendly.hint).toContain('ollama serve');
  });

  test('passes configuration errors through with their hint', () => {
    const friendly = toFriendlyError(
      new ProviderConfigError('No API key configured for OpenAI.', 'Set OPENAI_API_KEY')
    );
    expect(friendly.message).toContain('No API key');
    expect(friendly.hint).toBe('Set OPENAI_API_KEY');
  });
});

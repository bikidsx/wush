/**
 * Verifies the AI SDK contract the task layer relies on.
 *
 * This is the highest-value test in the suite: it proves `Output.object` plus
 * `partialOutputStream` actually produce the shapes `tasks.ts` assumes, using
 * the SDK's own mock model rather than a live provider.
 */

import { describe, expect, test } from 'bun:test';
import { Output, generateText, simulateReadableStream, streamText } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { commitMessageSchema } from '../src/services/ai/schemas.js';

const COMMIT_JSON = JSON.stringify({
  type: 'feat',
  scope: 'auth',
  subject: 'add token refresh endpoint',
  body: 'Sessions previously expired without a renewal path.',
});

/** Splits a JSON payload so partial parsing is genuinely exercised. */
function chunkText(text: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }
  return chunks;
}

describe('structured output contract', () => {
  test('generateText with Output.object returns a validated object', async () => {
    const result = await generateText({
      model: new MockLanguageModelV4({
        doGenerate: async () => ({
          content: [{ type: 'text', text: COMMIT_JSON }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: { total: 120, noCache: 120, cacheRead: undefined, cacheWrite: undefined },
            outputTokens: { total: 30, text: 30, reasoning: undefined },
          },
          warnings: [],
        }),
      }),
      output: Output.object({ schema: commitMessageSchema }),
      prompt: 'generate a commit message',
    });

    expect(result.output.type).toBe('feat');
    expect(result.output.scope).toBe('auth');
    expect(result.output.subject).toBe('add token refresh endpoint');

    // tasks.ts reads these as flat numbers when reporting usage.
    expect(result.usage.inputTokens).toBe(120);
    expect(result.usage.outputTokens).toBe(30);
  });

  test('streamText exposes progressively populated partial objects', async () => {
    const result = streamText({
      model: new MockLanguageModelV4({
        doStream: async () => ({
          stream: simulateReadableStream({
            chunks: [
              { type: 'text-start' as const, id: '1' },
              ...chunkText(COMMIT_JSON, 12).map((delta) => ({
                type: 'text-delta' as const,
                id: '1',
                delta,
              })),
              { type: 'text-end' as const, id: '1' },
              {
                type: 'finish' as const,
                finishReason: { unified: 'stop' as const, raw: undefined },
                usage: {
                  inputTokens: {
                    total: 120,
                    noCache: 120,
                    cacheRead: undefined,
                    cacheWrite: undefined,
                  },
                  outputTokens: { total: 30, text: 30, reasoning: undefined },
                },
              },
            ],
          }),
        }),
      }),
      output: Output.object({ schema: commitMessageSchema }),
      prompt: 'generate a commit message',
    });

    const partials: Array<Record<string, unknown>> = [];
    for await (const partial of result.partialOutputStream) {
      partials.push(partial as Record<string, unknown>);
    }

    // More than one partial proves incremental rendering is possible at all.
    expect(partials.length).toBeGreaterThan(1);

    const final = await result.output;
    expect(final.subject).toBe('add token refresh endpoint');

    // The TUI relies on `type` landing before the full object completes.
    expect(partials.some((p) => p.type === 'feat' && p.subject === undefined)).toBe(true);
  });
});

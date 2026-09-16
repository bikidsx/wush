/**
 * Model discovery tests.
 *
 * `fetch` is stubbed so each provider's response format is exercised without
 * network access, and so the offline fallback path is verifiable.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { clearModelCache, listModels } from '../src/services/ai/models.js';
import { config, resetConfig, setProviderSettings } from '../src/utils/config.js';

const realFetch = globalThis.fetch;

/** Replaces fetch with a router keyed by URL substring. */
function stubFetch(routes: Record<string, unknown>, onCall?: (url: string) => void) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input.toString();
    onCall?.(url);

    const match = Object.keys(routes).find((key) => url.includes(key));
    if (!match) {
      return new Response('not found', { status: 404 });
    }
    return new Response(JSON.stringify(routes[match]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

beforeEach(() => {
  resetConfig();
  clearModelCache();
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
});

afterEach(() => {
  globalThis.fetch = realFetch;
  resetConfig();
});

describe('model discovery', () => {
  test('parses the OpenAI wire format', async () => {
    stubFetch({
      '/models': { data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }] },
    });

    const { models, source } = await listModels('openai', { refresh: true });
    expect(source).toBe('live');
    expect(models.map((m) => m.id)).toContain('gpt-4o');
  });

  test('parses the Anthropic format including display names', async () => {
    stubFetch({
      '/models': {
        data: [{ id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' }],
      },
    });

    const { models } = await listModels('anthropic', { refresh: true });
    expect(models[0].id).toBe('claude-sonnet-4-5');
    expect(models[0].label).toBe('Claude Sonnet 4.5');
  });

  test('strips the models/ prefix Google returns', async () => {
    stubFetch({
      '/models': {
        models: [
          {
            name: 'models/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            supportedGenerationMethods: ['generateContent'],
          },
          {
            name: 'models/text-embedding-004',
            displayName: 'Embedding',
            supportedGenerationMethods: ['embedContent'],
          },
        ],
      },
    });

    const { models } = await listModels('google', { refresh: true });
    const ids = models.map((m) => m.id);

    expect(ids).toContain('gemini-2.5-pro');
    // Embedding-only models cannot generate commit messages.
    expect(ids).not.toContain('text-embedding-004');
  });

  test('reads Ollama native tags', async () => {
    stubFetch({
      '/api/tags': {
        models: [{ name: 'llama3.3:70b', details: { parameter_size: '70B' } }],
      },
    });

    const { models } = await listModels('ollama', { refresh: true });
    expect(models[0].id).toBe('llama3.3:70b');
    expect(models[0].description).toBe('70B');
  });

  test('falls back to known ids when the provider cannot be reached', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch;

    const { models, source } = await listModels('anthropic', { refresh: true });
    expect(source).toBe('fallback');
    expect(models.length).toBeGreaterThan(0);
  });

  test('serves a cached list without refetching', async () => {
    let calls = 0;
    stubFetch({ '/models': { data: [{ id: 'gpt-4o' }] } }, () => {
      calls += 1;
    });

    await listModels('openai', { refresh: true });
    expect(calls).toBe(1);

    const second = await listModels('openai');
    expect(second.source).toBe('cache');
    // The cached read must not touch the network again.
    expect(calls).toBe(1);
  });

  test('deprioritises non-chat models in the picker order', async () => {
    stubFetch({
      '/models': {
        data: [{ id: 'text-embedding-3-small' }, { id: 'gpt-4o' }, { id: 'whisper-1' }],
      },
    });

    const { models } = await listModels('openai', { refresh: true });
    // A chat model must be offered before embedding/audio models.
    expect(models[0].id).toBe('gpt-4o');
  });

  test('discovers models for a user-defined endpoint', async () => {
    config.set('customProviders', [
      { id: 'vllm', label: 'vLLM', baseUrl: 'http://localhost:8000/v1' },
    ]);
    setProviderSettings('vllm', { apiKey: 'x', baseUrl: 'http://localhost:8000/v1' });

    stubFetch({ '/models': { data: [{ id: 'mistral-7b' }] } });

    const { models, source } = await listModels('vllm', { refresh: true });
    expect(source).toBe('live');
    expect(models[0].id).toBe('mistral-7b');
  });
});

import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  BUILTIN_PROVIDERS,
  customProviderDefinition,
  findProvider,
} from '../src/services/ai/registry.js';
import {
  ProviderConfigError,
  availableProviders,
  resolveCredentials,
  resolveModel,
  resolveProvider,
} from '../src/services/ai/model.js';
import type { Config } from '../src/types/index.js';

/** Minimal config object, so tests do not depend on stored user state. */
function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    configVersion: 2,
    setupComplete: true,
    ai: { providerId: 'openai', model: 'gpt-4o', temperature: 0.4, maxOutputTokens: 1024 },
    providers: {},
    customProviders: [],
    modelCache: {},
    git: { conventionalCommits: true, autoStage: false },
    instructions: { commit: '', pr: '' },
    github: { token: '', defaultBranch: 'main' },
    ui: { tui: true, emoji: true, showUsage: true },
    security: {
      scanOnCommit: false,
      ignorePatterns: [],
      severity: { blockOnHigh: true, blockOnMedium: false, blockOnLow: false },
    },
    ...overrides,
  };
}

const SAVED_ENV = { ...process.env };

beforeEach(() => {
  // Provider keys leaking in from the developer's shell would mask failures.
  for (const key of Object.keys(process.env)) {
    if (/_API_KEY$|^OLLAMA_HOST$|^GEMINI_API_KEY$/.test(key)) delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...SAVED_ENV };
});

describe('registry', () => {
  test('exposes the documented built-in providers', () => {
    const ids = BUILTIN_PROVIDERS.map((p) => p.id);
    expect(ids).toContain('openai');
    expect(ids).toContain('anthropic');
    expect(ids).toContain('google');
    expect(ids).toContain('groq');
    expect(ids).toContain('azure');
    expect(ids).toContain('ollama');
    expect(ids).toContain('gateway');
    expect(ids).toContain('openai-compatible');
  });

  test('every provider declares the fields the resolver depends on', () => {
    for (const provider of BUILTIN_PROVIDERS) {
      expect(provider.label.length).toBeGreaterThan(0);
      expect(provider.discovery.kind).toBeDefined();
      expect(typeof provider.createModel).toBe('function');
    }
  });

  test('ollama needs no API key', () => {
    expect(findProvider('ollama')?.auth).toBe('none');
  });

  test('custom providers become first-class definitions', () => {
    const definition = customProviderDefinition({
      id: 'my-llm',
      label: 'My LLM',
      baseUrl: 'http://localhost:9000/v1',
    });

    expect(definition.builtin).toBe(false);
    expect(definition.id).toBe('my-llm');
    expect(findProvider('my-llm', [definition])?.label).toBe('My LLM');
  });
});

describe('credential resolution', () => {
  test('prefers an environment variable over the stored key', () => {
    process.env.OPENAI_API_KEY = 'from-env';
    const config = makeConfig({ providers: { openai: { apiKey: 'from-config' } } });

    const credentials = resolveCredentials(resolveProvider('openai', config), config);
    expect(credentials.apiKey).toBe('from-env');
  });

  test('falls back to the stored key when no env var is set', () => {
    const config = makeConfig({ providers: { openai: { apiKey: 'from-config' } } });

    const credentials = resolveCredentials(resolveProvider('openai', config), config);
    expect(credentials.apiKey).toBe('from-config');
  });

  test('reports a missing key with actionable guidance', () => {
    const config = makeConfig();

    expect(() => resolveCredentials(resolveProvider('openai', config), config)).toThrow(
      ProviderConfigError
    );

    try {
      resolveCredentials(resolveProvider('openai', config), config);
    } catch (error) {
      expect((error as ProviderConfigError).hint).toContain('OPENAI_API_KEY');
    }
  });

  test('does not require a key for a keyless provider', () => {
    const config = makeConfig({ ai: { ...makeConfig().ai, providerId: 'ollama' } });

    const credentials = resolveCredentials(resolveProvider('ollama', config), config);
    expect(credentials.baseUrl).toContain('11434');
  });

  test('rejects azure without a resource name or base URL', () => {
    const config = makeConfig({ providers: { azure: { apiKey: 'k' } } });

    expect(() => resolveCredentials(resolveProvider('azure', config), config)).toThrow(
      /resource name/i
    );
  });

  test('honours a custom base URL for self-hosted endpoints', () => {
    const config = makeConfig({
      providers: { openai: { apiKey: 'k', baseUrl: 'https://proxy.internal/v1' } },
    });

    const credentials = resolveCredentials(resolveProvider('openai', config), config);
    expect(credentials.baseUrl).toBe('https://proxy.internal/v1');
  });
});

describe('provider resolution', () => {
  test('unknown provider ids fail with the list of valid ones', () => {
    const config = makeConfig();
    expect(() => resolveProvider('nope', config)).toThrow(/Unknown AI provider/);
  });

  test('user-defined providers are resolvable', () => {
    const config = makeConfig({
      customProviders: [
        { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://localhost:1234/v1' },
      ],
      providers: { lmstudio: { apiKey: 'x' } },
    });

    expect(resolveProvider('lmstudio', config).label).toBe('LM Studio');
    expect(availableProviders(config).map((p) => p.id)).toContain('lmstudio');
  });

  test('builds a usable model handle for a custom endpoint', () => {
    const config = makeConfig({
      ai: { ...makeConfig().ai, providerId: 'lmstudio', model: 'local-model' },
      customProviders: [
        { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://localhost:1234/v1' },
      ],
      providers: { lmstudio: { apiKey: 'x', baseUrl: 'http://localhost:1234/v1' } },
    });

    const resolved = resolveModel({}, config);
    expect(resolved.modelId).toBe('local-model');
    expect(resolved.providerId).toBe('lmstudio');
    expect(resolved.model).toBeDefined();
  });

  test('does not carry a model id across a provider switch', () => {
    const config = makeConfig({
      ai: { ...makeConfig().ai, providerId: 'openai', model: 'gpt-4o' },
      providers: {
        openai: { apiKey: 'k' },
        anthropic: { apiKey: 'k', lastModel: 'claude-haiku-4-5' },
      },
    });

    // Requesting anthropic must not inherit OpenAI's selected model.
    const resolved = resolveModel({ providerId: 'anthropic' }, config);
    expect(resolved.modelId).toBe('claude-haiku-4-5');
  });
});

/**
 * Subscription provider tests.
 *
 * These providers delegate to a vendor CLI the user has already logged into, so
 * wush never handles a subscription token. The tests below lock in the parts
 * that are easy to regress: that no API key is demanded, that sampling params
 * are suppressed, and that a missing CLI login points at the CLI rather than
 * at `wush config`.
 */

import { describe, expect, test } from 'bun:test';
import { LoadAPIKeyError } from 'ai';
import { BUILTIN_PROVIDERS, findProvider } from '../src/services/ai/registry.js';
import { resolveCredentials, resolveProvider } from '../src/services/ai/model.js';
import { toFriendlyError } from '../src/services/ai/errors.js';
import { OptionalProviderError } from '../src/services/ai/optionalProviders.js';
import type { Config } from '../src/types/index.js';

function makeConfig(providerId: string): Config {
  return {
    configVersion: 2,
    setupComplete: true,
    ai: { providerId, model: '', temperature: 0.4, maxOutputTokens: 1024 },
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
  };
}

const SUBSCRIPTION_IDS = ['claude-subscription', 'chatgpt-subscription'];

describe('subscription providers', () => {
  for (const id of SUBSCRIPTION_IDS) {
    test(`${id} is registered with subscription auth`, () => {
      const provider = findProvider(id);
      expect(provider).toBeDefined();
      expect(provider?.auth).toBe('subscription');
    });

    test(`${id} declares the CLI it delegates to`, () => {
      const provider = findProvider(id);
      expect(provider?.requiresCli).toBeTruthy();
      expect(provider?.setupHint).toBeTruthy();
    });

    test(`${id} needs no API key`, () => {
      const config = makeConfig(id);
      // Must not throw the way an api-key provider does with no key present.
      const credentials = resolveCredentials(resolveProvider(id, config), config);
      expect(credentials.apiKey).toBeUndefined();
    });

    test(`${id} suppresses sampling params the CLI rejects`, () => {
      expect(findProvider(id)?.supportsSamplingParams).toBe(false);
    });

    test(`${id} still supports structured output`, () => {
      // wush's commit/PR flow depends entirely on schema-validated output.
      expect(findProvider(id)?.supportsStructuredOutputs).toBe(true);
    });

    test(`${id} declares a default model`, () => {
      expect(findProvider(id)?.fallbackModels.length).toBeGreaterThan(0);
    });
  }

  test('api-key providers still report sampling support by default', () => {
    const openai = findProvider('openai');
    expect(openai?.supportsSamplingParams ?? true).toBe(true);
  });

  test('every provider id is unique', () => {
    const ids = BUILTIN_PROVIDERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('subscription error mapping', () => {
  test('a missing CLI login points at the CLI, not wush config', () => {
    const friendly = toFriendlyError(new LoadAPIKeyError({ message: 'Not logged in · Please run /login' }), {
      providerLabel: 'Claude subscription (Pro/Max)',
      loginCommand: 'claude login',
    });

    expect(friendly.message).toContain('not logged in');
    expect(friendly.hint).toContain('claude login');
    // Re-running the request will not help until the user signs in.
    expect(friendly.retryable).toBe(false);
    expect(friendly.hint).not.toContain('wush config');
  });

  test('falls back to generic guidance without a login command', () => {
    const friendly = toFriendlyError(new LoadAPIKeyError({ message: 'Not logged in' }), {
      providerLabel: 'Some provider',
    });
    expect(friendly.hint).toContain('wush config');
  });

  test('a missing optional dependency explains how to install it', () => {
    const friendly = toFriendlyError(
      new OptionalProviderError(
        'Claude subscription support is not installed.',
        'Install it with `npm install -g ai-sdk-provider-claude-code`'
      )
    );

    expect(friendly.message).toContain('not installed');
    expect(friendly.hint).toContain('npm install');
    expect(friendly.retryable).toBe(false);
  });
});

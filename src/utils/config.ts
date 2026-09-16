import Conf from 'conf';
import type { Config } from '../types/index.js';

export const CONFIG_VERSION = 2;

/**
 * Defaults deliberately contain no model lists. Models are discovered at
 * runtime (see services/ai/models.ts); hardcoding them here is what caused
 * stale and invalid model ids previously.
 */
const defaultConfig: Config = {
  configVersion: CONFIG_VERSION,
  setupComplete: false,
  ai: {
    providerId: 'openai',
    model: '',
    temperature: 0.4,
    maxOutputTokens: 1024,
  },
  providers: {},
  customProviders: [],
  modelCache: {},
  git: {
    conventionalCommits: true,
    autoStage: false,
  },
  instructions: {
    commit: '',
    pr: '',
  },
  github: {
    token: '',
    defaultBranch: 'main',
  },
  ui: {
    tui: true,
    emoji: true,
    showUsage: true,
  },
  security: {
    scanOnCommit: false,
    ignorePatterns: ['*.test.ts', '*.spec.ts'],
    severity: {
      blockOnHigh: true,
      blockOnMedium: false,
      blockOnLow: false,
    },
  },
};

export const config = new Conf<Config>({
  projectName: 'wush',
  defaults: defaultConfig,
  // Lets tests (and sandboxed runs) redirect storage away from the real
  // user config directory.
  ...(process.env.WUSH_CONFIG_DIR ? { cwd: process.env.WUSH_CONFIG_DIR } : {}),
});

export function getConfig(): Config {
  return config.store;
}

export function updateConfig(updates: Partial<Config>): void {
  config.set(updates);
}

export function isSetupComplete(): boolean {
  return config.get('setupComplete') === true && !!config.get('ai')?.model;
}

/** Reads the settings blob for one provider, creating an empty one if absent. */
export function getProviderSettings(providerId: string) {
  return getConfig().providers?.[providerId] ?? {};
}

export function setProviderSettings(
  providerId: string,
  updates: Partial<Config['providers'][string]>
): void {
  const current = getProviderSettings(providerId);
  config.set(`providers.${providerId}`, { ...current, ...updates });
}

export function resetConfig(): void {
  config.clear();
}

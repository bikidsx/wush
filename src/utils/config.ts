import Conf from 'conf';
import type { Config } from '../types/index.js';

const defaultConfig: Config = {
  version: '1.0.0',
  setupComplete: false,
  ai: {
    provider: 'openai',
    model: 'gpt-5',
    apiKey: '',
    temperature: 0.7,
    maxTokens: 500,
  },
  providers: {
    openai: {
      apiKey: '',
      defaultModel: 'gpt-5',
      models: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-oss-120b', 'gpt-oss-20b'],
    },
    anthropic: {
      apiKey: '',
      defaultModel: 'claude-sonnet-4.5',
      models: ['claude-sonnet-4.5', 'claude-haiku-4.5'],
    },
    google: {
      apiKey: '',
      defaultModel: 'gemini-2.5-pro',
      models: ['gemini-2.5-pro', 'gemini-2.5-flash'],
      features: {
        deepThink: true,
      },
    },
    ollama: {
      baseUrl: 'http://localhost:11434',
      defaultModel: 'llama3.3:70b',
      models: ['llama3.3:70b', 'llama3.1:405b', 'qwen3:72b', 'gpt-oss-120b', 'gpt-oss-20b'],
    },
    groq: {
      apiKey: '',
      defaultModel: 'gpt-oss-120b',
      models: ['gpt-oss-120b', 'gpt-oss-20b', 'llama-4'],
    },
  },
  git: {
    conventionalCommits: true,
    autoStage: false,
  },
  github: {
    token: '',
    defaultBranch: 'main',
  },
  ui: {
    theme: 'default',
    emoji: true,
  },
  security: {
    scanOnCommit: false,
    autoFix: false,
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
});

export function getConfig(): Config {
  return config.store;
}

export function updateConfig(updates: Partial<Config>): void {
  config.set(updates);
}

export function isSetupComplete(): boolean {
  return config.get('setupComplete') === true;
}

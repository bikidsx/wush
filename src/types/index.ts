export type AIProvider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'groq';

export interface Config {
  version: string;
  setupComplete: boolean;
  ai: {
    provider: AIProvider;
    model: string;
    apiKey: string;
    temperature: number;
    maxTokens: number;
  };
  providers: {
    openai: ProviderConfig;
    anthropic: ProviderConfig;
    google: GoogleProviderConfig;
    ollama: OllamaProviderConfig;
    groq: ProviderConfig;
  };
  git: {
    conventionalCommits: boolean;
    autoStage: boolean;
  };
  instructions: {
    commit: string;
    pr: string;
  };
  github: {
    token: string;
    defaultBranch: string;
  };
  ui: {
    theme: string;
    emoji: boolean;
  };
  security: {
    scanOnCommit: boolean;
    autoFix: boolean;
    ignorePatterns: string[];
    severity: {
      blockOnHigh: boolean;
      blockOnMedium: boolean;
      blockOnLow: boolean;
    };
  };
}

export interface ProviderConfig {
  apiKey: string;
  defaultModel: string;
  models: string[];
}

export interface GoogleProviderConfig extends ProviderConfig {
  features: {
    deepThink: boolean;
  };
}

export interface OllamaProviderConfig extends Omit<ProviderConfig, 'apiKey'> {
  baseUrl: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface CommitMessage {
  title: string;
  body: string;
  type?: string;
  scope?: string;
}

export interface Vulnerability {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  type: string;
  file: string;
  line?: number;
  description: string;
  code?: string;
  fix?: string;
}

export interface ScanResult {
  vulnerabilities: Vulnerability[];
  summary: {
    high: number;
    medium: number;
    low: number;
  };
}

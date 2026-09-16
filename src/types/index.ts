/** Per-provider stored settings. Keyed by provider id, not a fixed union. */
export interface ProviderSettings {
  apiKey?: string;
  /** Overrides the provider default (self-hosted, proxy, regional endpoint). */
  baseUrl?: string;
  /** Last model chosen for this provider, so switching back is sticky. */
  lastModel?: string;
  /** Azure-only. */
  resourceName?: string;
  apiVersion?: string;
}

/** A user-defined OpenAI-compatible endpoint. */
export interface CustomProvider {
  id: string;
  label: string;
  baseUrl: string;
  /** Name of an env var holding the key, preferred over storing it. */
  apiKeyEnv?: string;
  supportsStructuredOutputs?: boolean;
}

export interface ModelInfo {
  id: string;
  label?: string;
  description?: string;
}

/** Cached model discovery result per provider id. */
export interface ModelCacheEntry {
  models: ModelInfo[];
  fetchedAt: number;
}

export interface Config {
  /** Config schema version. Bumped when the shape changes. */
  configVersion: number;
  setupComplete: boolean;
  ai: {
    /** Provider id from the registry, or a custom provider id. */
    providerId: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
  };
  /** Dynamic map — any provider id, including user-defined ones. */
  providers: Record<string, ProviderSettings>;
  customProviders: CustomProvider[];
  modelCache: Record<string, ModelCacheEntry>;
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
    /** Render the ink TUI instead of plain prompts. */
    tui: boolean;
    emoji: boolean;
    /** Show token counts and estimated cost after each call. */
    showUsage: boolean;
  };
  security: {
    scanOnCommit: boolean;
    ignorePatterns: string[];
    severity: {
      blockOnHigh: boolean;
      blockOnMedium: boolean;
      blockOnLow: boolean;
    };
  };
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface AIResult<T> {
  value: T;
  model: string;
  providerId: string;
  usage?: TokenUsage;
}

export interface CommitMessage {
  type: string;
  scope?: string;
  subject: string;
  body?: string;
}

export interface PRDescription {
  title: string;
  summary: string;
  changes: string[];
  testing?: string;
  notes?: string;
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

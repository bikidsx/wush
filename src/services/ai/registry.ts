/**
 * Data-driven provider registry.
 *
 * Every supported AI provider is described as *data*, not as a subclass.
 * Adding a provider means adding one entry to `BUILTIN_PROVIDERS` — no new
 * file, no factory `switch` branch, no type-union edit, and no hardcoded
 * menu to keep in sync.
 *
 * Anything speaking the OpenAI wire format (Ollama, LM Studio, OpenRouter,
 * DeepSeek, xAI, Together, vLLM, LiteLLM, ...) is reachable without a new
 * dependency via the `openai-compatible` transport, which is also what
 * user-defined custom providers use.
 */

import type { LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createAzure } from '@ai-sdk/azure';
import { createGateway } from '@ai-sdk/gateway';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { loadClaudeCodeProvider, loadCodexCliProvider } from './optionalProviders.js';

/** How a provider authenticates. */
export type AuthMode =
  | 'api-key' // requires a secret
  | 'none' // local / unauthenticated (e.g. default Ollama)
  | 'subscription'; // delegates to a vendor CLI the user already logged into

/**
 * How to enumerate models at runtime. The concrete fetching lives in
 * `models.ts`; the registry only declares *where* to look and *how* to read
 * the response, so a new provider does not need new discovery code.
 */
export interface ModelDiscovery {
  /**
   * `openai`     -> GET {baseUrl}/models        -> { data: [{ id }] }
   * `anthropic`  -> GET {baseUrl}/models        -> { data: [{ id, display_name }] }
   * `google`     -> GET {baseUrl}/models        -> { models: [{ name, displayName }] }
   * `ollama`     -> GET {baseUrl}/api/tags      -> { models: [{ name }] }
   * `gateway`    -> gateway.getAvailableModels()
   * `codex-cli`  -> listModels() from the Codex CLI app-server
   * `none`       -> not enumerable (e.g. Azure deployments)
   */
  kind: 'openai' | 'anthropic' | 'google' | 'ollama' | 'gateway' | 'codex-cli' | 'none';
  /** Overrides the provider baseUrl when the listing endpoint differs. */
  baseUrl?: string;
  /** Sends the key as this header instead of `Authorization: Bearer`. */
  apiKeyHeader?: string;
  /** Extra headers required by the listing endpoint (e.g. Anthropic version). */
  headers?: Record<string, string>;
}

/** Runtime values needed to instantiate a model. */
export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
  /** Azure-only. */
  resourceName?: string;
  apiVersion?: string;
}

export interface ProviderDefinition {
  id: string;
  label: string;
  /** One-line description shown in the provider picker. */
  description: string;
  auth: AuthMode;
  /** Environment variables consulted in order before stored config. */
  envKeys: string[];
  /** Default endpoint; user-overridable for self-hosted deployments. */
  defaultBaseUrl?: string;
  /** True when the user must supply the endpoint themselves. */
  requiresBaseUrl: boolean;
  /**
   * Fallback model used when discovery is unavailable (offline, listing
   * endpoint blocked). Never treated as the authoritative list.
   */
  fallbackModels: string[];
  discovery: ModelDiscovery;
  /** False for user-defined providers stored in config. */
  builtin: boolean;
  /**
   * Some OpenAI-compatible servers advertise the API but cannot honour
   * strict JSON schema output. Used to pick the structured-output strategy.
   */
  supportsStructuredOutputs: boolean;
  /**
   * False when the provider ignores `temperature` / `maxOutputTokens`.
   *
   * The CLI-backed providers do not accept them and emit an AI SDK warning per
   * call if they are sent, so the task layer omits them instead.
   */
  supportsSamplingParams?: boolean;
  /**
   * Executable that must be installed and logged in for a `subscription`
   * provider, e.g. `claude` or `codex`. Used to give a precise error instead
   * of a spawn failure.
   */
  requiresCli?: string;
  /** Human-readable instruction for making `requiresCli` usable. */
  setupHint?: string;
  /**
   * Builds a concrete AI SDK model handle.
   *
   * May be async because subscription providers are optional dependencies
   * loaded with a dynamic import, so that installing wush does not require
   * Node 22 or a vendor CLI.
   */
  createModel(
    modelId: string,
    credentials: ProviderCredentials
  ): LanguageModel | Promise<LanguageModel>;
}

/**
 * Builds an OpenAI-compatible provider. Shared by Ollama, custom endpoints,
 * and any OpenAI-wire-format service.
 */
function createCompatibleModel(
  name: string,
  fallbackBaseUrl: string,
  supportsStructuredOutputs: boolean
): ProviderDefinition['createModel'] {
  return (modelId, credentials) => {
    const provider = createOpenAICompatible({
      name,
      baseURL: credentials.baseUrl ?? fallbackBaseUrl,
      // Local servers ignore the key but the SDK requires a string.
      apiKey: credentials.apiKey ?? 'not-required',
      supportsStructuredOutputs,
    });
    return provider(modelId);
  };
}

export const BUILTIN_PROVIDERS: ProviderDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    description: 'GPT models direct from OpenAI',
    auth: 'api-key',
    envKeys: ['OPENAI_API_KEY'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    requiresBaseUrl: false,
    fallbackModels: ['gpt-4o', 'gpt-4o-mini'],
    discovery: { kind: 'openai' },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel(modelId, credentials) {
      return createOpenAI({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseUrl,
      })(modelId);
    },
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    description: 'Claude models direct from Anthropic',
    auth: 'api-key',
    envKeys: ['ANTHROPIC_API_KEY'],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    requiresBaseUrl: false,
    fallbackModels: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    discovery: {
      kind: 'anthropic',
      apiKeyHeader: 'x-api-key',
      headers: { 'anthropic-version': '2023-06-01' },
    },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel(modelId, credentials) {
      return createAnthropic({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseUrl,
      })(modelId);
    },
  },
  {
    id: 'google',
    label: 'Google',
    description: 'Gemini models via Google Generative AI',
    auth: 'api-key',
    envKeys: ['GOOGLE_GENERATIVE_AI_API_KEY', 'GEMINI_API_KEY'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresBaseUrl: false,
    fallbackModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    discovery: { kind: 'google' },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel(modelId, credentials) {
      return createGoogle({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseUrl,
      })(modelId);
    },
  },
  {
    id: 'groq',
    label: 'Groq',
    description: 'Open models on Groq LPU hardware (very fast)',
    auth: 'api-key',
    envKeys: ['GROQ_API_KEY'],
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    requiresBaseUrl: false,
    fallbackModels: ['llama-3.3-70b-versatile'],
    discovery: { kind: 'openai' },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel(modelId, credentials) {
      return createGroq({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseUrl,
      })(modelId);
    },
  },
  {
    id: 'azure',
    label: 'Azure OpenAI',
    description: 'OpenAI models hosted in your Azure tenant',
    auth: 'api-key',
    envKeys: ['AZURE_API_KEY', 'AZURE_OPENAI_API_KEY'],
    requiresBaseUrl: false,
    // Azure exposes user-named deployments, so no list is meaningful here.
    fallbackModels: [],
    discovery: { kind: 'none' },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel(modelId, credentials) {
      return createAzure({
        apiKey: credentials.apiKey,
        resourceName: credentials.resourceName,
        baseURL: credentials.baseUrl,
        apiVersion: credentials.apiVersion,
      })(modelId);
    },
  },
  {
    id: 'ollama',
    label: 'Ollama',
    description: 'Local models on your machine — free, no API key',
    auth: 'none',
    envKeys: ['OLLAMA_HOST'],
    defaultBaseUrl: 'http://localhost:11434/v1',
    requiresBaseUrl: false,
    fallbackModels: [],
    // Ollama's native tag listing is richer than its OpenAI shim.
    discovery: { kind: 'ollama', baseUrl: 'http://localhost:11434' },
    builtin: true,
    // Local models frequently fail strict schema mode; use JSON-mode prompting.
    supportsStructuredOutputs: false,
    createModel: createCompatibleModel('ollama', 'http://localhost:11434/v1', false),
  },
  {
    id: 'gateway',
    label: 'Vercel AI Gateway',
    description: 'One key, every major model, with live model discovery',
    auth: 'api-key',
    envKeys: ['AI_GATEWAY_API_KEY'],
    requiresBaseUrl: false,
    fallbackModels: ['openai/gpt-4o', 'anthropic/claude-sonnet-4-5'],
    discovery: { kind: 'gateway' },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel(modelId, credentials) {
      return createGateway({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseUrl,
      })(modelId);
    },
  },
  {
    id: 'claude-subscription',
    label: 'Claude subscription (Pro/Max)',
    description: 'Uses your Claude login via the Claude Code CLI — no API key, no token stored',
    auth: 'subscription',
    envKeys: [],
    requiresBaseUrl: false,
    // The CLI accepts aliases rather than dated model ids.
    fallbackModels: ['sonnet', 'opus', 'haiku'],
    discovery: { kind: 'none' },
    builtin: true,
    // Native constrained decoding via the Claude Agent SDK.
    supportsStructuredOutputs: true,
    // Claude Code rejects sampling params and warns once per call if sent.
    supportsSamplingParams: false,
    requiresCli: 'claude',
    setupHint: 'Install Claude Code and run `claude login`, then pick this provider.',
    async createModel(modelId) {
      const { createClaudeCode } = await loadClaudeCodeProvider();
      return createClaudeCode()(modelId);
    },
  },
  {
    id: 'chatgpt-subscription',
    label: 'ChatGPT subscription (Plus/Pro)',
    description: 'Uses your ChatGPT login via the Codex CLI — no API key, no token stored',
    auth: 'subscription',
    envKeys: [],
    requiresBaseUrl: false,
    fallbackModels: ['gpt-5-codex'],
    // The Codex app-server can enumerate models.
    discovery: { kind: 'codex-cli' },
    builtin: true,
    supportsStructuredOutputs: true,
    // Codex CLI rejects sampling params and warns once per call if sent.
    supportsSamplingParams: false,
    requiresCli: 'codex',
    setupHint: 'Install Codex CLI and run `codex login`, then pick this provider.',
    async createModel(modelId) {
      const { createCodexExec } = await loadCodexCliProvider();
      return createCodexExec()(modelId);
    },
  },
  {
    id: 'openai-compatible',
    label: 'Custom / OpenAI-compatible endpoint',
    description: 'Any OpenAI-format API — LM Studio, OpenRouter, vLLM, LiteLLM, self-hosted',
    auth: 'api-key',
    envKeys: [],
    requiresBaseUrl: true,
    fallbackModels: [],
    discovery: { kind: 'openai' },
    builtin: true,
    supportsStructuredOutputs: true,
    createModel: createCompatibleModel('custom', 'http://localhost:8000/v1', true),
  },
];

/** Definition for a user-defined provider stored in config. */
export function customProviderDefinition(custom: {
  id: string;
  label: string;
  baseUrl: string;
  apiKeyEnv?: string;
  supportsStructuredOutputs?: boolean;
}): ProviderDefinition {
  const supportsStructuredOutputs = custom.supportsStructuredOutputs ?? true;
  return {
    id: custom.id,
    label: custom.label,
    description: `Custom endpoint (${custom.baseUrl})`,
    auth: 'api-key',
    envKeys: custom.apiKeyEnv ? [custom.apiKeyEnv] : [],
    defaultBaseUrl: custom.baseUrl,
    requiresBaseUrl: true,
    fallbackModels: [],
    discovery: { kind: 'openai', baseUrl: custom.baseUrl },
    builtin: false,
    supportsStructuredOutputs,
    createModel: createCompatibleModel(custom.id, custom.baseUrl, supportsStructuredOutputs),
  };
}

export function findProvider(
  id: string,
  customs: ProviderDefinition[] = []
): ProviderDefinition | undefined {
  return [...BUILTIN_PROVIDERS, ...customs].find((p) => p.id === id);
}

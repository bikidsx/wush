/**
 * Turns stored configuration into a concrete AI SDK model handle.
 *
 * This is the single place that knows how a provider id + model id becomes
 * something `generateText`/`streamText` can call.
 */

import type { LanguageModel } from 'ai';
import {
  BUILTIN_PROVIDERS,
  customProviderDefinition,
  findProvider,
  type ProviderCredentials,
  type ProviderDefinition,
} from './registry.js';
import { getConfig } from '../../utils/config.js';
import type { Config } from '../../types/index.js';

export class ProviderConfigError extends Error {
  constructor(
    message: string,
    readonly hint?: string
  ) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

/** All providers currently available: built-ins plus user-defined ones. */
export function availableProviders(config: Config = getConfig()): ProviderDefinition[] {
  const customs = (config.customProviders ?? []).map(customProviderDefinition);
  return [...BUILTIN_PROVIDERS, ...customs];
}

export function resolveProvider(
  providerId: string,
  config: Config = getConfig()
): ProviderDefinition {
  const customs = (config.customProviders ?? []).map(customProviderDefinition);
  const definition = findProvider(providerId, customs);

  if (!definition) {
    const known = availableProviders(config)
      .map((p) => p.id)
      .join(', ');
    throw new ProviderConfigError(
      `Unknown AI provider "${providerId}".`,
      `Known providers: ${known}. Run \`wush config\` to pick one.`
    );
  }
  return definition;
}

/**
 * Resolves credentials with environment variables taking precedence over
 * stored config, so CI and shell exports work without writing secrets to disk.
 */
export function resolveCredentials(
  definition: ProviderDefinition,
  config: Config = getConfig()
): ProviderCredentials {
  const stored = config.providers?.[definition.id] ?? {};

  let apiKey: string | undefined;
  for (const envKey of definition.envKeys) {
    const fromEnv = process.env[envKey];
    if (fromEnv && fromEnv.trim()) {
      apiKey = fromEnv.trim();
      break;
    }
  }
  apiKey ??= stored.apiKey?.trim() || undefined;

  const baseUrl = stored.baseUrl?.trim() || definition.defaultBaseUrl;

  if (definition.auth === 'api-key' && !apiKey) {
    throw new ProviderConfigError(
      `No API key configured for ${definition.label}.`,
      definition.envKeys.length > 0
        ? `Set ${definition.envKeys[0]} or run \`wush config\`.`
        : 'Run `wush config` to add a key.'
    );
  }

  if (definition.requiresBaseUrl && !baseUrl) {
    throw new ProviderConfigError(
      `${definition.label} needs an endpoint URL.`,
      'Run `wush config` to set the base URL.'
    );
  }

  if (definition.id === 'azure' && !stored.resourceName && !stored.baseUrl) {
    throw new ProviderConfigError(
      'Azure OpenAI needs either a resource name or a full base URL.',
      'Run `wush config` to set your Azure resource.'
    );
  }

  return {
    apiKey,
    baseUrl,
    resourceName: stored.resourceName,
    apiVersion: stored.apiVersion,
  };
}

export interface ResolvedModel {
  model: LanguageModel;
  modelId: string;
  providerId: string;
  providerLabel: string;
  supportsStructuredOutputs: boolean;
  /** False for CLI-backed providers that ignore temperature/maxOutputTokens. */
  supportsSamplingParams: boolean;
}

/** Provider and model identity, without building a handle or needing credentials. */
export interface ModelSelection {
  providerId: string;
  providerLabel: string;
  modelId: string;
}

/** Picks the model id for a provider, preferring one chosen for that provider. */
function selectModelId(
  providerId: string,
  definition: ProviderDefinition,
  config: Config,
  override?: string
): string | undefined {
  return (
    override ??
    // Only reuse `ai.model` when it belongs to the provider being resolved, so
    // switching providers cannot carry an incompatible model id across.
    (providerId === config.ai.providerId ? config.ai.model || undefined : undefined) ??
    config.providers?.[providerId]?.lastModel ??
    definition.fallbackModels[0]
  );
}

/**
 * Describes the current selection synchronously.
 *
 * Used by the TUI to label the status bar before any request completes, and it
 * deliberately does not validate credentials so an unconfigured provider still
 * renders instead of throwing during a render pass.
 */
export function describeSelection(
  overrides: { providerId?: string; model?: string } = {},
  config: Config = getConfig()
): ModelSelection {
  const providerId = overrides.providerId ?? config.ai.providerId;

  try {
    const definition = resolveProvider(providerId, config);
    return {
      providerId,
      providerLabel: definition.label,
      modelId: selectModelId(providerId, definition, config, overrides.model) ?? 'unconfigured',
    };
  } catch {
    return { providerId, providerLabel: providerId, modelId: overrides.model ?? 'unconfigured' };
  }
}

/**
 * Resolves the configured (or explicitly requested) model.
 *
 * Async because subscription providers are optional dependencies loaded via
 * dynamic import.
 */
export async function resolveModel(
  overrides: { providerId?: string; model?: string } = {},
  config: Config = getConfig()
): Promise<ResolvedModel> {
  const providerId = overrides.providerId ?? config.ai.providerId;
  const definition = resolveProvider(providerId, config);
  const credentials = resolveCredentials(definition, config);
  const modelId = selectModelId(providerId, definition, config, overrides.model);

  if (!modelId) {
    throw new ProviderConfigError(
      `No model selected for ${definition.label}.`,
      'Run `wush config` and choose a model.'
    );
  }

  return {
    model: await definition.createModel(modelId, credentials),
    modelId,
    providerId: definition.id,
    providerLabel: definition.label,
    supportsStructuredOutputs: definition.supportsStructuredOutputs,
    supportsSamplingParams: definition.supportsSamplingParams ?? true,
  };
}

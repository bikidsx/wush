/**
 * Runtime model discovery.
 *
 * Model ids are fetched from each provider instead of being hardcoded. The
 * previous hardcoded lists had drifted into invalid ids (`claude-sonnet-4.5`
 * instead of `claude-sonnet-4-5`, `gpt-oss-120b` listed under OpenAI), and
 * users could never select a model the author had not anticipated.
 *
 * Results are cached so the picker stays instant, with the provider's
 * fallback list used when the network or endpoint is unavailable.
 */

import { config, getConfig } from '../../utils/config.js';
import { resolveCredentials, resolveProvider } from './model.js';
import type { ProviderDefinition } from './registry.js';
import type { ModelInfo } from '../../types/index.js';

/** Discovery results older than this are refetched. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export interface ListModelsResult {
  models: ModelInfo[];
  /** Where the list came from, so the UI can be honest about staleness. */
  source: 'live' | 'cache' | 'fallback';
}

async function fetchJson(
  url: string,
  headers: Record<string, string>
): Promise<unknown> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function authHeaders(definition: ProviderDefinition, apiKey?: string): Record<string, string> {
  if (!apiKey) return { ...definition.discovery.headers };

  const header = definition.discovery.apiKeyHeader;
  return header
    ? { [header]: apiKey, ...definition.discovery.headers }
    : { Authorization: `Bearer ${apiKey}`, ...definition.discovery.headers };
}

/** Performs the provider-specific listing call. */
async function discover(definition: ProviderDefinition): Promise<ModelInfo[]> {
  const { kind } = definition.discovery;
  if (kind === 'none') return [];

  const credentials = resolveCredentials(definition);
  const base = (definition.discovery.baseUrl ?? credentials.baseUrl ?? '').replace(/\/+$/, '');

  if (kind === 'gateway') {
    const { createGateway } = await import('@ai-sdk/gateway');
    const gateway = createGateway({ apiKey: credentials.apiKey });
    const available = await gateway.getAvailableModels();
    return available.models.map((m) => ({
      id: m.id,
      label: m.name,
      description: m.description ?? undefined,
    }));
  }

  if (kind === 'ollama') {
    const data = (await fetchJson(`${base}/api/tags`, {})) as {
      models?: Array<{ name: string; details?: { parameter_size?: string } }>;
    };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      label: m.name,
      description: m.details?.parameter_size,
    }));
  }

  if (kind === 'google') {
    // Google authenticates model listing by query parameter, not header.
    const data = (await fetchJson(`${base}/models?key=${credentials.apiKey ?? ''}`, {})) as {
      models?: Array<{
        name: string;
        displayName?: string;
        description?: string;
        supportedGenerationMethods?: string[];
      }>;
    };
    return (data.models ?? [])
      // Exclude embedding-only and other non-chat models.
      .filter((m) => m.supportedGenerationMethods?.includes('generateContent') ?? true)
      .map((m) => ({
        // Responses are namespaced as "models/gemini-...", the SDK wants the bare id.
        id: m.name.replace(/^models\//, ''),
        label: m.displayName,
        description: m.description,
      }));
  }

  if (kind === 'anthropic') {
    const data = (await fetchJson(
      `${base}/models`,
      authHeaders(definition, credentials.apiKey)
    )) as { data?: Array<{ id: string; display_name?: string }> };
    return (data.data ?? []).map((m) => ({ id: m.id, label: m.display_name }));
  }

  // OpenAI wire format, shared by OpenAI, Groq, and every compatible endpoint.
  const data = (await fetchJson(
    `${base}/models`,
    authHeaders(definition, credentials.apiKey)
  )) as { data?: Array<{ id: string }> };
  return (data.data ?? []).map((m) => ({ id: m.id }));
}

/**
 * Returns selectable models for a provider, preferring a live list and
 * degrading to cache then to the provider's fallback ids.
 */
export async function listModels(
  providerId: string,
  options: { refresh?: boolean } = {}
): Promise<ListModelsResult> {
  const definition = resolveProvider(providerId);
  const cached = getConfig().modelCache?.[providerId];
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  if (!options.refresh && fresh && cached.models.length > 0) {
    return { models: cached.models, source: 'cache' };
  }

  try {
    const models = await discover(definition);

    if (models.length > 0) {
      const sorted = sortModels(models);
      config.set(`modelCache.${providerId}`, { models: sorted, fetchedAt: Date.now() });
      return { models: sorted, source: 'live' };
    }
  } catch {
    // Discovery is best-effort; a provider that blocks listing must remain usable.
  }

  if (cached && cached.models.length > 0) {
    return { models: cached.models, source: 'cache' };
  }
  return {
    models: definition.fallbackModels.map((id) => ({ id })),
    source: 'fallback',
  };
}

/**
 * Orders models so the ids a developer most likely wants surface first.
 * Providers return arbitrary or creation order, which buries current models.
 */
function sortModels(models: ModelInfo[]): ModelInfo[] {
  const deprioritise = /embed|whisper|tts|audio|image|dall-e|moderation|rerank|guard/i;
  return [...models].sort((a, b) => {
    const aLow = deprioritise.test(a.id) ? 1 : 0;
    const bLow = deprioritise.test(b.id) ? 1 : 0;
    if (aLow !== bLow) return aLow - bLow;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

export function clearModelCache(providerId?: string): void {
  if (providerId) {
    const cache = { ...getConfig().modelCache };
    delete cache[providerId];
    config.set('modelCache', cache);
  } else {
    config.set('modelCache', {});
  }
}

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
import { classify, selectable } from './modelFilter.js';
import type { ProviderDefinition } from './registry.js';
import type { ModelInfo, ModelKind } from '../../types/index.js';

/** Discovery results older than this are refetched. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;

export interface ListModelsResult {
  models: ModelInfo[];
  /** Where the list came from, so the UI can be honest about staleness. */
  source: 'live' | 'cache' | 'fallback';
  /** How many models were filtered out as deprecated or non-language. */
  hiddenCount: number;
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
      // The gateway reports capability directly, so no inference is needed.
      kind: m.modelType === undefined || m.modelType === null ? undefined : mapGatewayKind(m.modelType),
    }));
  }

  if (kind === 'ollama') {
    const data = (await fetchJson(`${base}/api/tags`, {})) as {
      models?: Array<{
        name: string;
        modified_at?: string;
        details?: { parameter_size?: string };
      }>;
    };
    return (data.models ?? []).map((m) => ({
      id: m.name,
      label: m.name,
      description: m.details?.parameter_size,
      createdAt: m.modified_at ? Date.parse(m.modified_at) || undefined : undefined,
      // Locally pulled models are there because the user pulled them.
      kind: 'language' as const,
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
    return (data.models ?? []).map((m) => ({
      // Responses are namespaced as "models/gemini-...", the SDK wants the bare id.
      id: m.name.replace(/^models\//, ''),
      label: m.displayName,
      description: m.description,
      // supportedGenerationMethods is Google's explicit capability signal.
      kind: m.supportedGenerationMethods
        ? m.supportedGenerationMethods.includes('generateContent')
          ? ('language' as const)
          : inferGoogleKind(m.supportedGenerationMethods)
        : undefined,
    }));
  }

  if (kind === 'anthropic') {
    const data = (await fetchJson(
      `${base}/models`,
      authHeaders(definition, credentials.apiKey)
    )) as { data?: Array<{ id: string; display_name?: string; created_at?: string }> };

    return (data.data ?? []).map((m) => ({
      id: m.id,
      label: m.display_name,
      createdAt: m.created_at ? Date.parse(m.created_at) || undefined : undefined,
      // This endpoint only lists text models.
      kind: 'language' as const,
    }));
  }

  // OpenAI wire format, shared by OpenAI, Groq, and every compatible endpoint.
  // Extra fields are read defensively: `created` is standard, `active` and
  // `deprecated` are Groq/vendor extensions that are simply absent elsewhere.
  const data = (await fetchJson(
    `${base}/models`,
    authHeaders(definition, credentials.apiKey)
  )) as {
    data?: Array<{
      id: string;
      created?: number;
      active?: boolean;
      deprecated?: boolean;
      description?: string;
    }>;
  };

  return (data.data ?? []).map((m) => ({
    id: m.id,
    description: m.description,
    // OpenAI-format `created` is in seconds.
    createdAt: typeof m.created === 'number' ? m.created * 1000 : undefined,
    deprecated: m.deprecated === true || m.active === false || undefined,
    deprecationNote:
      m.active === false ? 'reported inactive by the provider' : undefined,
  }));
}

/** Maps the gateway's modelType onto our capability vocabulary. */
function mapGatewayKind(modelType: string): ModelKind {
  switch (modelType) {
    case 'language':
      return 'language';
    case 'embedding':
      return 'embedding';
    case 'image':
      return 'image';
    case 'speech':
      return 'speech';
    case 'transcription':
      return 'transcription';
    case 'video':
      return 'video';
    case 'reranking':
      return 'reranking';
    default:
      // 'realtime' and anything the gateway adds later.
      return 'unknown';
  }
}

/** Derives a capability from Google's supported method list. */
function inferGoogleKind(methods: string[]): ModelKind {
  if (methods.includes('embedContent') || methods.includes('embedText')) return 'embedding';
  if (methods.includes('predict') || methods.includes('predictLongRunning')) return 'image';
  return 'unknown';
}

export interface ListModelsOptions {
  refresh?: boolean;
  /** Include deprecated and non-language models that are hidden by default. */
  includeAll?: boolean;
}

/**
 * Returns selectable models for a provider, preferring a live list and
 * degrading to cache then to the provider's fallback ids.
 *
 * The complete discovered list is cached and filtering happens on read, so
 * toggling `includeAll` never triggers a refetch.
 */
export async function listModels(
  providerId: string,
  options: ListModelsOptions = {}
): Promise<ListModelsResult> {
  const definition = resolveProvider(providerId);
  const cached = getConfig().modelCache?.[providerId];
  const fresh = cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS;

  const present = (models: ModelInfo[], source: ListModelsResult['source']) => {
    const visible = selectable(models, { includeAll: options.includeAll });
    return {
      models: visible,
      source,
      hiddenCount: models.length - visible.length,
    };
  };

  if (!options.refresh && fresh && cached.models.length > 0) {
    return present(cached.models, 'cache');
  }

  try {
    const models = await discover(definition);

    if (models.length > 0) {
      // Cache everything discovered, including filtered-out entries.
      const classified = models.map(classify);
      config.set(`modelCache.${providerId}`, { models: classified, fetchedAt: Date.now() });
      return present(classified, 'live');
    }
  } catch {
    // Discovery is best-effort; a provider that blocks listing must remain usable.
  }

  if (cached && cached.models.length > 0) {
    return present(cached.models, 'cache');
  }
  return present(
    definition.fallbackModels.map((id) => ({ id, kind: 'language' as const })),
    'fallback'
  );
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

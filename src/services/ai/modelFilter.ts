/**
 * Model classification.
 *
 * Decides which discovered models are usable for text generation, which the
 * provider has flagged as deprecated, and how recent each one is.
 *
 * Deliberately contains NO list of specific model names. Every decision comes
 * from a signal the provider itself returned, because a curated blocklist would
 * reintroduce exactly the staleness that hardcoded model lists caused: it would
 * be wrong the moment a provider shipped or retired something.
 */

import type { ModelInfo, ModelKind } from '../../types/index.js';

/**
 * Capability inference for endpoints that report no capability field.
 *
 * These are matched against the model id as a last resort, and only for
 * families whose purpose is unambiguous from the name. A false negative here
 * merely leaves a model in the list; it never hides a usable one.
 */
const KIND_PATTERNS: Array<{ kind: ModelKind; pattern: RegExp }> = [
  { kind: 'embedding', pattern: /(^|[-/])(embed|embedding)|text-embedding/i },
  { kind: 'transcription', pattern: /whisper|transcrib/i },
  { kind: 'speech', pattern: /\btts\b|text-to-speech|speech-\d|audio-preview/i },
  { kind: 'image', pattern: /dall-?e|stable-diffusion|flux|imagen|(^|[-/])image(-|$)/i },
  { kind: 'video', pattern: /\bveo\b|sora|(^|[-/])video(-|$)/i },
  { kind: 'reranking', pattern: /rerank/i },
  { kind: 'moderation', pattern: /moderation|guard/i },
];

/**
 * Deprecation wording that refers to the model being described.
 *
 * Anchored to statements about this model, so a description like "replaces the
 * deprecated foo-1.0" is not mistaken for a deprecation of the new model.
 */
const DEPRECATION_PATTERNS: RegExp[] = [
  /\b(?:is|has been|was)\s+(?:now\s+)?(?:deprecated|discontinued|retired|sunset)\b/i,
  /^\s*(?:deprecated|discontinued|retired|legacy)\b/i,
  /\bno longer (?:supported|available|recommended)\b/i,
  /\b(?:will be|scheduled to be)\s+(?:removed|retired|discontinued|shut down)\b/i,
  /\bend[- ]of[- ]life\b/i,
  /\bdeprecated on \d/i,
];

/** Dated snapshot suffixes, e.g. -2024-11-20, -0613, @20240229. */
const SNAPSHOT_PATTERN = /[-@_](?:\d{4}-\d{2}-\d{2}|\d{8}|\d{4})$/;

export function inferKind(id: string): ModelKind {
  for (const { kind, pattern } of KIND_PATTERNS) {
    if (pattern.test(id)) return kind;
  }
  return 'unknown';
}

/** Detects a provider statement that this model is deprecated. */
export function detectDeprecation(text: string | undefined): string | undefined {
  if (!text) return undefined;

  for (const pattern of DEPRECATION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) return match[0].trim();
  }
  return undefined;
}

export function isSnapshot(id: string): boolean {
  return SNAPSHOT_PATTERN.test(id);
}

/** Fills in any classification the provider did not supply directly. */
export function classify(model: ModelInfo): ModelInfo {
  const kind = model.kind ?? inferKind(model.id);

  // A provider flag always wins over text inference.
  const note =
    model.deprecationNote ??
    detectDeprecation(model.description) ??
    detectDeprecation(model.label);

  return {
    ...model,
    kind,
    deprecated: model.deprecated || note !== undefined,
    deprecationNote: model.deprecationNote ?? note,
    snapshot: model.snapshot ?? isSnapshot(model.id),
  };
}

export interface SelectableOptions {
  /** Include deprecated and non-language models. */
  includeAll?: boolean;
}

/**
 * Narrows a discovered list to what can actually generate commit messages,
 * newest first.
 */
export function selectable(models: ModelInfo[], options: SelectableOptions = {}): ModelInfo[] {
  const classified = models.map(classify);

  const usable = options.includeAll
    ? classified
    : classified.filter((m) => {
        // Non-language models cannot perform any wush task.
        if (m.kind !== 'language' && m.kind !== 'unknown') return false;
        if (m.deprecated) return false;
        return true;
      });

  return sortModels(usable);
}

/**
 * Newest first when the provider dates its models, since that is what a
 * developer almost always wants. Falls back to a stable id comparison, with
 * pinned snapshots after their floating aliases.
 */
export function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    // Deprecated entries sink, for when they are shown via includeAll.
    if (Boolean(a.deprecated) !== Boolean(b.deprecated)) return a.deprecated ? 1 : -1;

    // Non-language models sink below usable ones.
    const aOther = a.kind && a.kind !== 'language' && a.kind !== 'unknown' ? 1 : 0;
    const bOther = b.kind && b.kind !== 'language' && b.kind !== 'unknown' ? 1 : 0;
    if (aOther !== bOther) return aOther - bOther;

    // Prefer floating aliases over pinned snapshots of the same family.
    if (Boolean(a.snapshot) !== Boolean(b.snapshot)) return a.snapshot ? 1 : -1;

    if (a.createdAt && b.createdAt && a.createdAt !== b.createdAt) {
      return b.createdAt - a.createdAt;
    }

    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

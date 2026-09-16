/**
 * The AI capability layer.
 *
 * One function per task, provider-agnostic. Previously each of six provider
 * classes reimplemented these four operations against its vendor SDK; the
 * provider is now just data resolved by `model.ts`.
 *
 * Structured tasks use `generateText`/`streamText` with `Output.object()`.
 * (`generateObject`/`streamObject` are deprecated as of AI SDK v6.)
 */

import { Output, generateText, streamText } from 'ai';
import { resolveModel, type ResolvedModel } from './model.js';
import {
  branchNameSchema,
  commitMessageSchema,
  prDescriptionSchema,
  securityFindingsSchema,
  type CommitMessageOutput,
  type PRDescriptionOutput,
  type SecurityFindingsOutput,
} from './schemas.js';
import {
  buildCommitPrompt,
  buildPRPrompt,
  buildSecurityPrompt,
  getSystemPrompt,
} from './prompts.js';
import { getConfig } from '../../utils/config.js';
import type { AIResult, TokenUsage } from '../../types/index.js';

/** Options shared by every task. */
export interface TaskOptions {
  providerId?: string;
  model?: string;
  customInstructions?: string;
  abortSignal?: AbortSignal;
  /** Called with each incremental partial object, for live TUI rendering. */
  onPartial?: (partial: unknown) => void;
}

const DEFAULT_TIMEOUT_MS = 60_000;

function normaliseUsage(usage: {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}): TokenUsage | undefined {
  if (usage.totalTokens === undefined && usage.inputTokens === undefined) return undefined;
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
  };
}

/**
 * Combines a caller-supplied abort signal with a timeout, so a hung provider
 * cannot block the CLI forever.
 */
function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

/**
 * Runs a structured task. When `onPartial` is supplied the response is
 * streamed so the UI can render fields as they arrive; otherwise a single
 * blocking call is used.
 */
async function runStructured<T>(
  resolved: ResolvedModel,
  schema: Parameters<typeof Output.object>[0]['schema'],
  system: string,
  prompt: string,
  options: TaskOptions,
  maxOutputTokens: number
): Promise<AIResult<T>> {
  const abortSignal = withTimeout(options.abortSignal, DEFAULT_TIMEOUT_MS);
  const output = Output.object({ schema });

  const shared = {
    model: resolved.model,
    system,
    prompt,
    output,
    abortSignal,
    maxOutputTokens,
    temperature: getConfig().ai.temperature,
  };

  if (options.onPartial) {
    const result = streamText(shared);

    for await (const partial of result.partialOutputStream) {
      options.onPartial(partial);
    }

    return {
      value: (await result.output) as T,
      model: resolved.modelId,
      providerId: resolved.providerId,
      usage: normaliseUsage(await result.usage),
    };
  }

  const result = await generateText(shared);
  return {
    value: result.output as T,
    model: resolved.modelId,
    providerId: resolved.providerId,
    usage: normaliseUsage(result.usage),
  };
}

export async function generateCommitMessage(
  diff: string,
  options: TaskOptions = {}
): Promise<AIResult<CommitMessageOutput>> {
  const config = getConfig();
  const resolved = resolveModel({ providerId: options.providerId, model: options.model }, config);

  return runStructured<CommitMessageOutput>(
    resolved,
    commitMessageSchema,
    getSystemPrompt('commit'),
    buildCommitPrompt(diff, {
      conventional: config.git.conventionalCommits,
      customInstructions: options.customInstructions || config.instructions.commit,
    }),
    options,
    600
  );
}

export async function generatePRDescription(
  commits: string[],
  diff: string,
  options: TaskOptions = {}
): Promise<AIResult<PRDescriptionOutput>> {
  const config = getConfig();
  const resolved = resolveModel({ providerId: options.providerId, model: options.model }, config);

  return runStructured<PRDescriptionOutput>(
    resolved,
    prDescriptionSchema,
    getSystemPrompt('pr'),
    buildPRPrompt(commits, diff, {
      customInstructions: options.customInstructions || config.instructions.pr,
    }),
    options,
    1500
  );
}

export async function generateBranchName(
  description: string,
  type: string,
  options: TaskOptions = {}
): Promise<AIResult<string>> {
  const resolved = resolveModel({ providerId: options.providerId, model: options.model });

  const result = await runStructured<{ name: string }>(
    resolved,
    branchNameSchema,
    'You generate concise git branch names in lowercase kebab-case. Never include a type prefix.',
    `Generate a branch name segment for this ${type} work:\n\n${description}`,
    options,
    100
  );

  // Defend against models that ignore the casing instruction.
  const slug = result.value.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

  return { ...result, value: slug };
}

export async function analyzeSecurityIssues(
  code: string,
  filename: string,
  options: TaskOptions = {}
): Promise<AIResult<SecurityFindingsOutput>> {
  const resolved = resolveModel({ providerId: options.providerId, model: options.model });

  return runStructured<SecurityFindingsOutput>(
    resolved,
    securityFindingsSchema,
    getSystemPrompt('security'),
    buildSecurityPrompt(code, filename),
    options,
    2000
  );
}

/**
 * Streams plain text. Used by the TUI for free-form explanations where no
 * schema applies.
 */
export function streamPlainText(
  system: string,
  prompt: string,
  options: TaskOptions = {}
) {
  const resolved = resolveModel({ providerId: options.providerId, model: options.model });
  return streamText({
    model: resolved.model,
    system,
    prompt,
    abortSignal: withTimeout(options.abortSignal, DEFAULT_TIMEOUT_MS),
  });
}

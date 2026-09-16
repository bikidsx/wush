/**
 * Schemas for structured AI output.
 *
 * These replace the string parsing the CLI used previously: the PR command
 * derived its title by stripping markdown from the first line, and the scanner
 * recovered findings by regex-matching a JSON array out of prose. Both broke
 * whenever a model formatted its answer differently. Schemas make the shape
 * the model's problem, validated by the SDK.
 */

import { z } from 'zod';

export const COMMIT_TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
] as const;

export const commitMessageSchema = z.object({
  type: z
    .enum(COMMIT_TYPES)
    .describe('Conventional Commits type that best classifies the change'),
  scope: z
    .string()
    .optional()
    .describe('Affected module or component, omitted when the change is broad'),
  subject: z
    .string()
    .describe('Imperative summary under 50 characters, no trailing period'),
  body: z
    .string()
    .optional()
    .describe('Optional detail explaining what changed and why, wrapped at 72 characters'),
});

export type CommitMessageOutput = z.infer<typeof commitMessageSchema>;

/** Renders the structured commit message into git's expected text form. */
export function formatCommitMessage(message: CommitMessageOutput): string {
  const scope = message.scope ? `(${message.scope})` : '';
  const header = `${message.type}${scope}: ${message.subject}`;
  return message.body?.trim() ? `${header}\n\n${message.body.trim()}` : header;
}

export const prDescriptionSchema = z.object({
  title: z.string().describe('Imperative PR title under 72 characters'),
  summary: z.string().describe('Two or three sentences on why this change exists'),
  changes: z.array(z.string()).describe('Specific changes made, one bullet each'),
  testing: z.string().optional().describe('How the change was or should be tested'),
  notes: z.string().optional().describe('Breaking changes, migrations, or reviewer context'),
});

export type PRDescriptionOutput = z.infer<typeof prDescriptionSchema>;

/** Renders the structured PR body as the markdown GitHub expects. */
export function formatPRBody(pr: PRDescriptionOutput): string {
  const sections = [`## Summary\n\n${pr.summary}`];

  if (pr.changes.length > 0) {
    sections.push(`## Changes\n\n${pr.changes.map((c) => `- ${c}`).join('\n')}`);
  }
  if (pr.testing?.trim()) {
    sections.push(`## Testing\n\n${pr.testing.trim()}`);
  }
  if (pr.notes?.trim()) {
    sections.push(`## Notes\n\n${pr.notes.trim()}`);
  }
  return sections.join('\n\n');
}

export const branchNameSchema = z.object({
  name: z
    .string()
    .describe('Branch name segment in lowercase kebab-case, max 30 chars, no type prefix'),
});

export const securityFindingsSchema = z.object({
  findings: z.array(
    z.object({
      severity: z.enum(['HIGH', 'MEDIUM', 'LOW']),
      type: z.string().describe('Vulnerability class, e.g. SQL Injection'),
      line: z.number().optional().describe('1-based line number when identifiable'),
      description: z.string().describe('Why this is exploitable'),
      fix: z.string().describe('Concrete remediation'),
    })
  ),
});

export type SecurityFindingsOutput = z.infer<typeof securityFindingsSchema>;

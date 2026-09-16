/**
 * CommitView integration test.
 *
 * Stubs the AI task module so the full flow — stream partials, render, present
 * actions, commit — is exercised without a provider or a git repository.
 */

import React from 'react';
import { afterEach, describe, expect, mock, test } from 'bun:test';
import { render } from 'ink-testing-library';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const committed: string[] = [];

// Stubbed before importing the view, so it binds to these implementations.
await mock.module('../src/services/ai/tasks.js', () => ({
  generateCommitMessage: async (_diff: string, options: any) => {
    // Emit partials in the order a real model stream produces them.
    options?.onPartial?.({ type: 'feat' });
    await wait(20);
    options?.onPartial?.({ type: 'feat', scope: 'auth', subject: 'add token refresh' });
    await wait(20);

    return {
      value: {
        type: 'feat',
        scope: 'auth',
        subject: 'add token refresh',
        body: 'Sessions had no renewal path.',
      },
      model: 'mock-model',
      providerId: 'mock',
      usage: { inputTokens: 100, outputTokens: 25, totalTokens: 125 },
    };
  },
}));

await mock.module('../src/services/git.js', () => ({
  GitService: class {
    async commit(message: string) {
      committed.push(message);
    }
  },
}));

await mock.module('../src/services/ai/model.js', () => ({
  // The view reads identity synchronously for the status bar.
  describeSelection: () => ({
    providerId: 'mock',
    providerLabel: 'Mock Provider',
    modelId: 'mock-model',
  }),
  resolveModel: async () => ({
    providerLabel: 'Mock Provider',
    modelId: 'mock-model',
    providerId: 'mock',
    supportsStructuredOutputs: true,
    model: {},
  }),
  ProviderConfigError: class extends Error {},
}));

const { CommitView } = await import('../src/tui/views/CommitView.js');

afterEach(() => {
  committed.length = 0;
});

describe('CommitView', () => {
  test('streams, then presents the completed message with actions', async () => {
    const { lastFrame, unmount } = render(
      <CommitView diff="diff --git a/a b/a" stagedFiles={['a.ts']} onExit={() => {}} />
    );

    // Initial state: work in progress.
    expect(lastFrame()).toContain('1 file staged');

    await wait(200);
    const frame = lastFrame() ?? '';
    unmount();

    // Final state: the message and the action menu.
    expect(frame).toContain('feat(auth): add token refresh');
    expect(frame).toContain('Sessions had no renewal path.');
    expect(frame).toContain('Accept and commit');
    expect(frame).toContain('Mock Provider');
    // Usage reported from the result.
    expect(frame).toContain('100');
  });

  test('accepting commits the formatted message', async () => {
    const exited: { value: { committed: boolean } | null } = { value: null };

    const { stdin, unmount } = render(
      <CommitView
        diff="d"
        stagedFiles={['a.ts']}
        onExit={(summary) => (exited.value = summary)}
      />
    );

    await wait(200);
    stdin.write('a'); // accept hotkey
    await wait(150);
    unmount();

    expect(committed).toEqual(['feat(auth): add token refresh\n\nSessions had no renewal path.']);
    expect(exited.value?.committed).toBe(true);
  });

  test('cancelling exits without committing', async () => {
    const exited: { value: { committed: boolean } | null } = { value: null };

    const { stdin, unmount } = render(
      <CommitView diff="d" stagedFiles={[]} onExit={(summary) => (exited.value = summary)} />
    );

    await wait(200);
    stdin.write('c'); // cancel hotkey
    await wait(100);
    unmount();

    expect(committed).toEqual([]);
    expect(exited.value?.committed).toBe(false);
  });

  test('shows a plural file count correctly', async () => {
    const { lastFrame, unmount } = render(
      <CommitView diff="d" stagedFiles={['a.ts', 'b.ts']} onExit={() => {}} />
    );

    expect(lastFrame()).toContain('2 files staged');
    await wait(200);
    unmount();
  });
});

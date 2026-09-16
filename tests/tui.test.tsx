/**
 * TUI rendering tests.
 *
 * Renders components through ink's test renderer to confirm they actually draw
 * and animate, rather than only typechecking.
 */

import React from 'react';
import { describe, expect, test } from 'bun:test';
import { render } from 'ink-testing-library';
import { Thinking } from '../src/tui/components/Thinking.js';
import { Select } from '../src/tui/components/Select.js';
import { StatusBar } from '../src/tui/components/StatusBar.js';
import { CommitCard } from '../src/tui/components/CommitCard.js';
import { SPINNER_FRAMES, formatElapsed } from '../src/tui/theme.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Thinking indicator', () => {
  test('renders a spinner frame, the label, and a cancel hint', () => {
    const { lastFrame } = render(<Thinking active label="Analyzing staged changes" />);
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Analyzing staged changes');
    expect(frame).toContain('esc to cancel');
    expect(SPINNER_FRAMES.some((f) => frame.includes(f))).toBe(true);
  });

  test('animates over time', async () => {
    const { lastFrame, unmount } = render(<Thinking active label="Working" />);
    const first = lastFrame();

    // Long enough to cross several 80ms frame boundaries.
    await wait(300);
    const later = lastFrame();
    unmount();

    expect(later).not.toBe(first);
  });

  test('renders nothing when inactive, so finished views stay static', () => {
    const { lastFrame } = render(<Thinking active={false} label="Working" />);
    expect(lastFrame()).toBe('');
  });

  test('shows streamed detail beneath the label', () => {
    const { lastFrame } = render(
      <Thinking active label="Writing commit message" detail="add token refresh" />
    );
    expect(lastFrame()).toContain('add token refresh');
  });
});

describe('Select', () => {
  const items = [
    { label: 'Accept and commit', value: 'accept', hotkey: 'a' },
    { label: 'Regenerate', value: 'regenerate', hotkey: 'r' },
    { label: 'Cancel', value: 'cancel', hotkey: 'c' },
  ];

  test('marks the first item as selected initially', () => {
    const { lastFrame } = render(<Select items={items} onSelect={() => {}} />);
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Accept and commit');
    expect(frame).toContain('❯');
  });

  test('moves the pointer on arrow keys', async () => {
    const { lastFrame, stdin, unmount } = render(<Select items={items} onSelect={() => {}} />);
    const before = lastFrame();

    stdin.write('\u001B[B'); // down arrow
    await wait(50);
    const after = lastFrame();
    unmount();

    expect(after).not.toBe(before);
  });

  test('invokes onSelect via a hotkey', async () => {
    const picked: { value: string | null } = { value: null };
    const { stdin, unmount } = render(
      <Select items={items} onSelect={(value) => (picked.value = value)} />
    );

    stdin.write('r');
    await wait(50);
    unmount();

    expect(picked.value).toBe('regenerate');
  });

  test('ignores input while disabled', async () => {
    const picked: { value: string | null } = { value: null };
    const { stdin, unmount } = render(
      <Select items={items} onSelect={(value) => (picked.value = value)} disabled />
    );

    stdin.write('a');
    await wait(50);
    unmount();

    expect(picked.value).toBeNull();
  });
});

describe('StatusBar', () => {
  test('names the provider and model', () => {
    const { lastFrame } = render(<StatusBar providerLabel="Anthropic" model="claude-haiku-4-5" />);
    const frame = lastFrame() ?? '';

    expect(frame).toContain('Anthropic');
    expect(frame).toContain('claude-haiku-4-5');
  });

  test('reports token usage when present', () => {
    const { lastFrame } = render(
      <StatusBar
        providerLabel="OpenAI"
        model="gpt-4o"
        usage={{ inputTokens: 120, outputTokens: 30, totalTokens: 150 }}
      />
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('120');
    expect(frame).toContain('30');
  });
});

describe('CommitCard', () => {
  test('renders a partial object mid-stream without crashing', () => {
    // Mirrors the real stream order: `type` arrives before `subject`.
    const { lastFrame } = render(<CommitCard message={{ type: 'feat' }} streaming />);
    expect(lastFrame()).toContain('feat');
  });

  test('renders the full conventional header once complete', () => {
    const { lastFrame } = render(
      <CommitCard
        message={{ type: 'feat', scope: 'auth', subject: 'add token refresh' }}
      />
    );
    const frame = lastFrame() ?? '';

    expect(frame).toContain('feat(auth): add token refresh');
  });

  test('includes the body when provided', () => {
    const { lastFrame } = render(
      <CommitCard
        message={{ type: 'fix', subject: 'handle empty diff', body: 'Prevented a crash.' }}
      />
    );
    expect(lastFrame()).toContain('Prevented a crash.');
  });

  test('renders nothing without a message', () => {
    const { lastFrame } = render(<CommitCard message={null} />);
    expect(lastFrame()).toBe('');
  });
});

describe('elapsed formatting', () => {
  test('scales units with duration', () => {
    expect(formatElapsed(450)).toBe('450ms');
    expect(formatElapsed(1500)).toBe('1.5s');
    expect(formatElapsed(62_000)).toBe('1m 02s');
  });
});

import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { TokenUsage } from '../../types/index.js';

interface StatusBarProps {
  providerLabel: string;
  model: string;
  usage?: TokenUsage | null;
  /** Extra right-aligned note, e.g. repository branch. */
  note?: string;
}

/**
 * Persistent footer identifying which model produced the output.
 *
 * Worth showing at all times: with dynamic providers a user can easily forget
 * whether they are on a local 7B model or a frontier one, and the quality
 * difference in commit messages is large.
 */
export function StatusBar({ providerLabel, model, usage, note }: StatusBarProps) {
  return (
    <Box>
      <Text color={theme.color.muted}>{theme.symbol.bullet} </Text>
      <Text color={theme.color.brand}>{providerLabel}</Text>
      <Text color={theme.color.muted}> {theme.symbol.dot} </Text>
      <Text color={theme.color.accent}>{model}</Text>

      {usage ? (
        <Text color={theme.color.muted}>
          {' '}
          {theme.symbol.dot} {usage.inputTokens}↑ {usage.outputTokens}↓
        </Text>
      ) : null}

      {note ? (
        <Text color={theme.color.muted}>
          {' '}
          {theme.symbol.dot} {note}
        </Text>
      ) : null}
    </Box>
  );
}

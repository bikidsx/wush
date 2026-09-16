import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../theme.js';
import type { CommitMessageOutput } from '../../services/ai/schemas.js';

interface CommitCardProps {
  /** Partial while streaming, complete once resolved. */
  message: Partial<CommitMessageOutput> | null;
  /** Dims the card to signal it is still being written. */
  streaming?: boolean;
}

/**
 * Renders a commit message, tolerating missing fields.
 *
 * Accepts partials because `partialOutputStream` fills fields progressively —
 * `type` typically arrives before `subject`, which arrives before `body`.
 */
export function CommitCard({ message, streaming = false }: CommitCardProps) {
  if (!message) return null;

  const header = message.subject
    ? `${message.type ?? '…'}${message.scope ? `(${message.scope})` : ''}: ${message.subject}`
    : message.type
      ? `${message.type}: …`
      : '…';

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={streaming ? theme.color.accentDim : theme.color.accent}
      paddingX={1}
    >
      <Text bold color={streaming ? theme.color.muted : theme.color.text} wrap="wrap">
        {header}
      </Text>

      {message.body?.trim() ? (
        <Box marginTop={1}>
          <Text color={theme.color.muted} wrap="wrap">
            {message.body.trim()}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

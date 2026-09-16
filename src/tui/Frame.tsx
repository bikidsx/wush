import React from 'react';
import { Box, Text } from 'ink';
import { theme } from './theme.js';
import { useFrame } from './hooks/useFrame.js';

interface FrameProps {
  title: string;
  /** Animates the accent underline while work is in progress. */
  busy?: boolean;
  children: React.ReactNode;
}

/**
 * Shared chrome for every TUI view.
 *
 * Uses a fixed-height header and a growing body so the layout does not jump as
 * content streams in — reflowing the frame on every token is the main source of
 * flicker in terminal UIs.
 */
export function Frame({ title, busy = false, children }: FrameProps) {
  const frame = useFrame(busy, 120);

  // A short travelling highlight reads as activity without redrawing the body.
  const width = 28;
  const position = busy ? frame % width : -1;
  const underline = Array.from({ length: width }, (_, i) =>
    i === position || i === position - 1 ? '━' : '─'
  ).join('');

  return (
    <Box flexDirection="column" paddingX={1} paddingY={0}>
      <Box>
        <Text bold color={theme.color.brand}>
          wush
        </Text>
        <Text color={theme.color.muted}> {theme.symbol.dot} </Text>
        <Text color={theme.color.text}>{title}</Text>
      </Box>

      <Text color={busy ? theme.color.accent : theme.color.muted}>{underline}</Text>

      <Box flexDirection="column" marginTop={1}>
        {children}
      </Box>
    </Box>
  );
}

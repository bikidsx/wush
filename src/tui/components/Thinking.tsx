import React from 'react';
import { Box, Text } from 'ink';
import { PULSE_FRAMES, SPINNER_FRAMES, formatElapsed, theme } from '../theme.js';
import { useElapsed, useFrame } from '../hooks/useFrame.js';

interface ThinkingProps {
  active: boolean;
  /** Current activity, ideally derived from real stream progress. */
  label: string;
  /** Rendered dim beneath the label, e.g. the partial subject line. */
  detail?: string;
  /** Shows the Esc-to-cancel hint. */
  cancellable?: boolean;
}

/**
 * The "AI is working" affordance.
 *
 * Deliberately shows elapsed time and a real activity label. The previous CLI
 * rotated invented phrases ("Almost there...") on a timer, which conveyed no
 * information and misrepresented progress.
 */
export function Thinking({ active, label, detail, cancellable = true }: ThinkingProps) {
  const frame = useFrame(active);
  const elapsed = useElapsed(active);

  if (!active) return null;

  const spinner = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
  const pulse = PULSE_FRAMES[frame % PULSE_FRAMES.length];

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.color.accent}>{spinner} </Text>
        <Text color={theme.color.text}>{label}</Text>
        <Text color={theme.color.muted}>
          {'  '}
          {formatElapsed(elapsed)}
        </Text>
      </Box>

      <Box marginTop={0}>
        <Text color={theme.color.accentDim}>{'  '}{pulse}</Text>
        {cancellable && <Text color={theme.color.muted}>  esc to cancel</Text>}
      </Box>

      {detail ? (
        <Box marginTop={1}>
          <Text color={theme.color.muted}>{'  '}{theme.symbol.arrow} </Text>
          <Text color={theme.color.brand}>{detail}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

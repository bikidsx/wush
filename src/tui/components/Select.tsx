import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme.js';

export interface SelectItem<T> {
  label: string;
  value: T;
  /** Single-key shortcut, e.g. 'a' for accept. */
  hotkey?: string;
  hint?: string;
  color?: string;
}

interface SelectProps<T> {
  items: SelectItem<T>[];
  onSelect: (value: T) => void;
  /** Disables input while an async action is in flight. */
  disabled?: boolean;
}

/**
 * Arrow-key menu with optional single-key shortcuts.
 *
 * Written rather than taken from `ink-select-input` so hotkeys, hints, and
 * colours match the rest of the interface, and so wrapping behaviour is
 * predictable at the list edges.
 */
export function Select<T>({ items, onSelect, disabled = false }: SelectProps<T>) {
  const [index, setIndex] = useState(0);

  useInput(
    (input, key) => {
      if (key.upArrow || input === 'k') {
        setIndex((i) => (i - 1 + items.length) % items.length);
        return;
      }
      if (key.downArrow || input === 'j') {
        setIndex((i) => (i + 1) % items.length);
        return;
      }
      if (key.return) {
        onSelect(items[index].value);
        return;
      }

      const hit = items.find((item) => item.hotkey && item.hotkey === input.toLowerCase());
      if (hit) onSelect(hit.value);
    },
    { isActive: !disabled }
  );

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const selected = i === index;
        return (
          <Box key={String(item.value)}>
            <Text color={selected ? theme.color.accent : theme.color.muted}>
              {selected ? `${theme.symbol.pointer} ` : '  '}
            </Text>
            <Text
              color={item.color ?? (selected ? theme.color.text : theme.color.muted)}
              bold={selected}
            >
              {item.label}
            </Text>
            {item.hotkey ? (
              <Text color={theme.color.muted}> [{item.hotkey}]</Text>
            ) : null}
            {item.hint && selected ? (
              <Text color={theme.color.muted}>  {item.hint}</Text>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

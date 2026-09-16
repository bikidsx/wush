import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { GitService } from '../../services/git.js';
import { generateCommitMessage } from '../../services/ai/tasks.js';
import { formatCommitMessage, type CommitMessageOutput } from '../../services/ai/schemas.js';
import { resolveModel } from '../../services/ai/model.js';
import { toFriendlyError } from '../../services/ai/errors.js';
import { useAITask } from '../hooks/useAITask.js';
import { Thinking } from '../components/Thinking.js';
import { Select, type SelectItem } from '../components/Select.js';
import { StatusBar } from '../components/StatusBar.js';
import { CommitCard } from '../components/CommitCard.js';
import { theme } from '../theme.js';

type Action = 'accept' | 'edit' | 'regenerate' | 'cancel';
type Stage = 'generating' | 'review' | 'editing' | 'committing' | 'finished';

interface CommitViewProps {
  diff: string;
  /** Files staged for commit, shown as context while generating. */
  stagedFiles: string[];
  onExit: (summary: { committed: boolean; message?: string; error?: string }) => void;
}

export function CommitView({ diff, stagedFiles, onExit }: CommitViewProps) {
  const { exit } = useApp();
  const [stage, setStage] = useState<Stage>('generating');
  const [editValue, setEditValue] = useState('');
  const [commitError, setCommitError] = useState<string | null>(null);

  // Resolved once so the status bar can name the model before any call returns.
  const [modelInfo] = useState(() => {
    try {
      const resolved = resolveModel();
      return { label: resolved.providerLabel, model: resolved.modelId };
    } catch {
      return { label: 'unknown', model: 'unconfigured' };
    }
  });

  const task = useCallback(
    (options: Parameters<typeof generateCommitMessage>[1]) =>
      generateCommitMessage(diff, options),
    [diff]
  );

  const ai = useAITask<CommitMessageOutput>(task);

  // Kick off generation on mount.
  useEffect(() => {
    ai.run();
    // Intentionally runs once; `ai.run` is stable via useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ai.phase === 'done') setStage('review');
    if (ai.phase === 'error' || ai.phase === 'cancelled') setStage('review');
  }, [ai.phase]);

  const finish = useCallback(
    (summary: { committed: boolean; message?: string; error?: string }) => {
      setStage('finished');
      onExit(summary);
      exit();
    },
    [exit, onExit]
  );

  const performCommit = useCallback(
    async (message: string) => {
      setStage('committing');
      try {
        await new GitService().commit(message);
        finish({ committed: true, message });
      } catch (error) {
        const friendly = toFriendlyError(error);
        setCommitError(friendly.message);
        setStage('review');
      }
    },
    [finish]
  );

  // Esc cancels an in-flight request; it should not also quit the app.
  useInput(
    (input, key) => {
      if (key.escape) {
        if (ai.phase === 'running') {
          ai.cancel();
        } else if (stage === 'review') {
          finish({ committed: false });
        }
      }
    },
    { isActive: stage !== 'editing' }
  );

  const onAction = useCallback(
    (action: Action) => {
      if (action === 'accept' && ai.result) {
        void performCommit(formatCommitMessage(ai.result.value));
        return;
      }
      if (action === 'edit' && ai.result) {
        setEditValue(formatCommitMessage(ai.result.value));
        setStage('editing');
        return;
      }
      if (action === 'regenerate') {
        setCommitError(null);
        setStage('generating');
        ai.run();
        return;
      }
      finish({ committed: false });
    },
    [ai, finish, performCommit]
  );

  const running = ai.phase === 'running';

  // Derive a truthful activity label from what the model has produced so far.
  const partial = ai.partial as Partial<CommitMessageOutput> | null;
  const label = partial?.subject
    ? 'Writing commit message'
    : partial?.type
      ? `Classified as ${partial.type}`
      : 'Analyzing staged changes';

  const actions: SelectItem<Action>[] = [
    { label: 'Accept and commit', value: 'accept', hotkey: 'a', color: theme.color.success },
    { label: 'Edit before committing', value: 'edit', hotkey: 'e', color: theme.color.warn },
    { label: 'Regenerate', value: 'regenerate', hotkey: 'r', color: theme.color.brand },
    { label: 'Cancel', value: 'cancel', hotkey: 'c', color: theme.color.danger },
  ];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color={theme.color.muted}>
          {stagedFiles.length} file{stagedFiles.length === 1 ? '' : 's'} staged
        </Text>
      </Box>

      {running ? (
        <Thinking active label={label} detail={partial?.subject} />
      ) : null}

      {(running && partial) || ai.result ? (
        <Box marginTop={1}>
          <CommitCard
            message={ai.result ? ai.result.value : partial}
            streaming={running}
          />
        </Box>
      ) : null}

      {ai.phase === 'error' && ai.error ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.color.danger}>
            {theme.symbol.cross} {ai.error.message}
          </Text>
          {ai.error.hint ? <Text color={theme.color.muted}>  {ai.error.hint}</Text> : null}
        </Box>
      ) : null}

      {ai.phase === 'cancelled' ? (
        <Box marginTop={1}>
          <Text color={theme.color.warn}>Generation cancelled.</Text>
        </Box>
      ) : null}

      {commitError ? (
        <Box marginTop={1}>
          <Text color={theme.color.danger}>
            {theme.symbol.cross} {commitError}
          </Text>
        </Box>
      ) : null}

      {stage === 'editing' ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color={theme.color.muted}>Edit message, Enter to commit:</Text>
          <Box>
            <Text color={theme.color.accent}>{theme.symbol.pointer} </Text>
            <TextInput
              value={editValue}
              onChange={setEditValue}
              onSubmit={(value) => {
                if (value.trim()) void performCommit(value.trim());
              }}
            />
          </Box>
        </Box>
      ) : null}

      {stage === 'committing' ? (
        <Box marginTop={1}>
          <Thinking active label="Committing" cancellable={false} />
        </Box>
      ) : null}

      {stage === 'review' ? (
        <Box marginTop={1}>
          <Select
            items={
              ai.result ? actions : actions.filter((a) => a.value !== 'accept' && a.value !== 'edit')
            }
            onSelect={onAction}
          />
        </Box>
      ) : null}

      <Box marginTop={1}>
        <StatusBar
          providerLabel={modelInfo.label}
          model={modelInfo.model}
          usage={ai.result?.usage}
        />
      </Box>
    </Box>
  );
}

export default CommitView;

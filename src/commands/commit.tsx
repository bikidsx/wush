import React from 'react';
import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { GitService } from '../services/git.js';
import { generateCommitMessage } from '../services/ai/tasks.js';
import { formatCommitMessage, type CommitMessageOutput } from '../services/ai/schemas.js';
import { friendlyError } from '../services/ai/friendly.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';
import { runTui, supportsTui } from '../tui/run.js';
import { CommitView } from '../tui/views/CommitView.js';

export async function commitCommand(): Promise<void> {
  const git = new GitService();

  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  const diff = await git.getStagedDiff();

  if (!diff) {
    logger.warning('No staged changes found');

    const { stageAll } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'stageAll',
        message: 'Stage all changes?',
        default: false,
      },
    ]);

    if (!stageAll) process.exit(0);

    await git.stageAll();
    const newDiff = await git.getStagedDiff();
    if (!newDiff) {
      logger.error('No changes to commit');
      process.exit(1);
    }
    return commitWithDiff(newDiff, git);
  }

  await commitWithDiff(diff, git);
}

/** Chooses the interactive interface, falling back when the terminal cannot host it. */
async function commitWithDiff(diff: string, git: GitService): Promise<void> {
  if (getConfig().ui.tui && supportsTui()) {
    return commitWithTui(diff, git);
  }
  return commitWithPrompts(diff, git);
}

async function commitWithTui(diff: string, git: GitService): Promise<void> {
  const status = await git.getStatus();
  const stagedFiles: string[] = status.staged ?? [];

  const summary = await runTui<{ committed: boolean; message?: string; error?: string }>(
    'commit',
    (resolve) => (
      <CommitView diff={diff} stagedFiles={stagedFiles} onExit={resolve} />
    )
  );

  if (summary.committed) {
    logger.success('Committed successfully');
  } else if (summary.error) {
    logger.error(summary.error);
    process.exit(1);
  } else {
    logger.info('Commit cancelled');
  }
}

/**
 * Generates a message, reporting real progress from the model stream rather
 * than a timed carousel of invented status strings.
 */
async function generate(diff: string): Promise<{
  message: CommitMessageOutput;
  modelLabel: string;
  usageLabel: string;
}> {
  const config = getConfig();
  const spinner = ora({ text: chalk.cyan('Contacting model...'), color: 'cyan' }).start();

  try {
    const result = await generateCommitMessage(diff, {
      onPartial: (partial) => {
        // Reflect what the model has actually committed to so far.
        const p = partial as Partial<CommitMessageOutput>;
        if (p?.subject) {
          spinner.text = chalk.cyan(`${p.type ?? '...'}: ${p.subject}`);
        } else if (p?.type) {
          spinner.text = chalk.cyan(`Classified as ${p.type}...`);
        } else {
          spinner.text = chalk.cyan('Analyzing diff...');
        }
      },
    });

    spinner.succeed(chalk.green('Commit message ready'));

    const usageLabel =
      config.ui.showUsage && result.usage
        ? chalk.dim(
            `  ${result.usage.inputTokens} in / ${result.usage.outputTokens} out tokens`
          )
        : '';

    return {
      message: result.value,
      modelLabel: chalk.dim(`  ${result.providerId} · ${result.model}`),
      usageLabel,
    };
  } catch (error) {
    spinner.fail(chalk.red('Failed to generate commit message'));
    throw error;
  }
}

function renderMessage(message: CommitMessageOutput): void {
  const text = formatCommitMessage(message);
  const lines = text.split('\n');
  const width = Math.max(...lines.map((l) => l.length), 50);
  const border = '─'.repeat(width + 2);

  logger.newline();
  console.log(chalk.cyan(`┌${border}┐`));
  for (const line of lines) {
    console.log(chalk.cyan('│ ') + chalk.white(line.padEnd(width)) + chalk.cyan(' │'));
  }
  console.log(chalk.cyan(`└${border}┘`));
}

async function commitWithPrompts(diff: string, git: GitService): Promise<void> {
  try {
    let { message, modelLabel, usageLabel } = await generate(diff);

    // Loop so regeneration does not recurse or duplicate the render logic.
    for (;;) {
      renderMessage(message);
      console.log(modelLabel);
      if (usageLabel) console.log(usageLabel);
      logger.newline();

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: [
            { name: chalk.green('✓ Accept'), value: 'accept' },
            { name: chalk.yellow('✎ Edit'), value: 'edit' },
            { name: chalk.blue('↻ Regenerate'), value: 'regenerate' },
            { name: chalk.red('✗ Cancel'), value: 'cancel' },
          ],
        },
      ]);

      if (action === 'accept') {
        await performCommit(formatCommitMessage(message), git);
        return;
      }

      if (action === 'edit') {
        const { editedMessage } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'editedMessage',
            message: 'Edit commit message:',
            default: formatCommitMessage(message),
          },
        ]);
        await performCommit(editedMessage, git);
        return;
      }

      if (action === 'regenerate') {
        ({ message, modelLabel, usageLabel } = await generate(diff));
        continue;
      }

      logger.info('Commit cancelled');
      return;
    }
  } catch (error) {
    const friendly = friendlyError(error);
    logger.error(friendly.message);
    if (friendly.hint) logger.dim(`  ${friendly.hint}`);
    process.exit(1);
  }
}

async function performCommit(message: string, git: GitService): Promise<void> {
  const spinner = ora({ text: chalk.cyan('Committing...'), color: 'green' }).start();

  try {
    await git.commit(message);
    spinner.succeed(chalk.green('Committed successfully'));
  } catch (error: any) {
    spinner.fail(chalk.red('Commit failed'));
    logger.error(error.message);
  }
}

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { GitService } from '../services/git.js';
import { createAIProvider } from '../services/ai/factory.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

export async function commitCommand(): Promise<void> {
  const git = new GitService();

  // Check if in git repo
  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  // Get staged changes
  const spinner = ora('Analyzing changes...').start();
  const diff = await git.getStagedDiff();

  if (!diff) {
    spinner.stop();
    logger.warning('No staged changes found');
    
    const { stageAll } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'stageAll',
        message: 'Stage all changes?',
        default: false,
      },
    ]);

    if (stageAll) {
      await git.stageAll();
      const newDiff = await git.getStagedDiff();
      if (!newDiff) {
        logger.error('No changes to commit');
        process.exit(1);
      }
      return commitWithDiff(newDiff, git, spinner);
    }
    process.exit(0);
  }

  await commitWithDiff(diff, git, spinner);
}

async function commitWithDiff(diff: string, git: GitService, spinner: ReturnType<typeof ora>): Promise<void> {
  spinner.text = 'Generating commit message...';
  
  try {
    const ai = createAIProvider();
    const response = await ai.generateCommitMessage(diff);
    spinner.stop();

    logger.newline();
    logger.info('Suggested commit message:');
    console.log(chalk.cyan(`\n  ${response.content}\n`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Accept', value: 'accept' },
          { name: 'Edit', value: 'edit' },
          { name: 'Regenerate', value: 'regenerate' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ]);

    switch (action) {
      case 'accept':
        await performCommit(response.content, git);
        break;
      case 'edit':
        const { editedMessage } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'editedMessage',
            message: 'Edit commit message:',
            default: response.content,
          },
        ]);
        await performCommit(editedMessage, git);
        break;
      case 'regenerate':
        spinner.start('Regenerating...');
        const newResponse = await ai.generateCommitMessage(diff);
        spinner.stop();
        console.log(chalk.cyan(`\n  ${newResponse.content}\n`));
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Use this message?',
            default: true,
          },
        ]);
        if (confirm) {
          await performCommit(newResponse.content, git);
        }
        break;
      case 'cancel':
        logger.info('Commit cancelled');
        break;
    }
  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to generate commit message: ${error.message}`);
    process.exit(1);
  }
}

async function performCommit(message: string, git: GitService): Promise<void> {
  const spinner = ora('Committing...').start();
  try {
    await git.commit(message);
    spinner.stop();
    logger.success('Committed successfully!');
  } catch (error: any) {
    spinner.stop();
    logger.error(`Commit failed: ${error.message}`);
  }
}

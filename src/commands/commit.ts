import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { GitService } from '../services/git.js';
import { createAIProvider } from '../services/ai/factory.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

const AI_SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const THINKING_MESSAGES = [
  '🧠 AI is thinking...',
  '✨ Analyzing your changes...',
  '🔍 Understanding the code...',
  '💭 Crafting the perfect message...',
  '🎯 Almost there...',
];

function createAISpinner(initialText: string) {
  return ora({
    text: initialText,
    spinner: {
      interval: 80,
      frames: AI_SPINNER_FRAMES,
    },
    color: 'cyan',
  });
}

async function animatedAIGeneration<T>(
  task: () => Promise<T>,
  spinner: ReturnType<typeof ora>
): Promise<T> {
  let messageIndex = 0;
  
  const interval = setInterval(() => {
    messageIndex = (messageIndex + 1) % THINKING_MESSAGES.length;
    spinner.text = chalk.cyan(THINKING_MESSAGES[messageIndex]);
  }, 1500);

  try {
    const result = await task();
    clearInterval(interval);
    return result;
  } catch (error) {
    clearInterval(interval);
    throw error;
  }
}

export async function commitCommand(): Promise<void> {
  const git = new GitService();

  // Check if in git repo
  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  // Get staged changes
  const spinner = createAISpinner('🔍 Analyzing changes...');
  spinner.start();
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
      return commitWithDiff(newDiff, git);
    }
    process.exit(0);
  }

  spinner.stop();
  await commitWithDiff(diff, git);
}

async function commitWithDiff(diff: string, git: GitService): Promise<void> {
  const config = getConfig();
  const customInstructions = config.instructions?.commit || '';
  
  const spinner = createAISpinner(chalk.cyan(THINKING_MESSAGES[0]));
  spinner.start();
  
  try {
    const ai = createAIProvider();
    const response = await animatedAIGeneration(
      () => ai.generateCommitMessage(diff, { 
        customInstructions,
        conventional: config.git.conventionalCommits 
      }),
      spinner
    );
    
    spinner.succeed(chalk.green('✨ Commit message generated!'));

    logger.newline();
    
    // Beautiful box for the commit message
    const lines = response.content.split('\n');
    const maxLen = Math.max(...lines.map(l => l.length), 50);
    const border = '─'.repeat(maxLen + 2);
    
    console.log(chalk.cyan(`┌${border}┐`));
    for (const line of lines) {
      console.log(chalk.cyan('│ ') + chalk.white(line.padEnd(maxLen)) + chalk.cyan(' │'));
    }
    console.log(chalk.cyan(`└${border}┘`));
    
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
        const regenSpinner = createAISpinner(chalk.cyan('🔄 Regenerating...'));
        regenSpinner.start();
        const newResponse = await animatedAIGeneration(
          () => ai.generateCommitMessage(diff, { 
            customInstructions,
            conventional: config.git.conventionalCommits 
          }),
          regenSpinner
        );
        regenSpinner.succeed(chalk.green('✨ New message generated!'));
        
        logger.newline();
        const newLines = newResponse.content.split('\n');
        const newMaxLen = Math.max(...newLines.map(l => l.length), 50);
        const newBorder = '─'.repeat(newMaxLen + 2);
        
        console.log(chalk.cyan(`┌${newBorder}┐`));
        for (const line of newLines) {
          console.log(chalk.cyan('│ ') + chalk.white(line.padEnd(newMaxLen)) + chalk.cyan(' │'));
        }
        console.log(chalk.cyan(`└${newBorder}┘`));
        logger.newline();
        
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
    spinner.fail(chalk.red('Failed to generate commit message'));
    logger.error(error.message);
    process.exit(1);
  }
}

async function performCommit(message: string, git: GitService): Promise<void> {
  const spinner = ora({
    text: chalk.cyan('📝 Committing...'),
    spinner: 'dots',
    color: 'green',
  }).start();
  
  try {
    await git.commit(message);
    spinner.succeed(chalk.green('🎉 Committed successfully!'));
  } catch (error: any) {
    spinner.fail(chalk.red('Commit failed'));
    logger.error(error.message);
  }
}

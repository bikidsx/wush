import chalk from 'chalk';
import figures from 'figures';
import { GitService } from '../services/git.js';
import { logger } from '../utils/logger.js';

export async function statusCommand(): Promise<void> {
  const git = new GitService();

  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  const status = await git.getStatus();
  const branch = await git.getCurrentBranch();

  logger.newline();
  console.log(chalk.bold('Branch:'), chalk.cyan(branch));
  logger.newline();

  // Staged files
  if (status.staged.length > 0) {
    console.log(chalk.green.bold('Staged changes:'));
    for (const file of status.staged) {
      console.log(chalk.green(`  ${figures.tick} ${file}`));
    }
    logger.newline();
  }

  // Modified files
  if (status.modified.length > 0) {
    console.log(chalk.yellow.bold('Modified:'));
    for (const file of status.modified) {
      console.log(chalk.yellow(`  ${figures.bullet} ${file}`));
    }
    logger.newline();
  }

  // Untracked files
  if (status.not_added.length > 0) {
    console.log(chalk.red.bold('Untracked:'));
    for (const file of status.not_added) {
      console.log(chalk.red(`  ${figures.cross} ${file}`));
    }
    logger.newline();
  }

  // Summary
  const total = status.staged.length + status.modified.length + status.not_added.length;
  if (total === 0) {
    logger.success('Working tree clean');
  } else {
    console.log(chalk.dim(`${status.staged.length} staged, ${status.modified.length} modified, ${status.not_added.length} untracked`));
  }
}

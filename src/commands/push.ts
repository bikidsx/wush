import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { GitService } from '../services/git.js';
import { logger } from '../utils/logger.js';

interface PushOptions {
  force?: boolean;
  upstream?: boolean;
}

export async function pushCommand(options: PushOptions): Promise<void> {
  const git = new GitService();

  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  const branch = await git.getCurrentBranch();
  const hasUpstream = await git.hasUpstream();

  // A branch with no upstream cannot be pushed without -u.
  let setUpstream = options.upstream ?? false;
  if (!hasUpstream && !setUpstream) {
    const { confirmUpstream } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmUpstream',
        message: `Branch ${chalk.cyan(branch)} has no upstream. Push and set origin/${branch} as upstream?`,
        default: true,
      },
    ]);

    if (!confirmUpstream) {
      logger.info('Push cancelled');
      return;
    }
    setUpstream = true;
  }

  // Force push rewrites remote history and can destroy teammates' commits.
  if (options.force) {
    logger.warning(
      `Force push overwrites the remote history of ${chalk.cyan(branch)}. ` +
        'Commits on the remote that you do not have locally will be lost.'
    );

    const { confirmForce } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmForce',
        message: 'Are you sure you want to force push?',
        default: false,
      },
    ]);

    if (!confirmForce) {
      logger.info('Force push cancelled');
      return;
    }
  }

  const spinner = ora({
    text: chalk.cyan(`Pushing ${branch} to origin...`),
    spinner: 'dots',
  }).start();

  try {
    await git.push({ force: options.force, setUpstream });
    spinner.succeed(chalk.green(`Pushed ${branch} to origin`));
  } catch (error: any) {
    spinner.fail(chalk.red('Push failed'));
    logger.error(error.message);
    process.exit(1);
  }
}

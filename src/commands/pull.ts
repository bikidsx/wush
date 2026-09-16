import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { GitService } from '../services/git.js';
import { logger } from '../utils/logger.js';

interface PullOptions {
  rebase?: boolean;
  force?: boolean;
}

export async function pullCommand(options: PullOptions): Promise<void> {
  const git = new GitService();

  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  const branch = await git.getCurrentBranch();
  const status = await git.getStatus();
  const dirtyFiles: string[] = [
    ...status.modified,
    ...status.deleted,
    ...status.renamed.map((r: { from: string; to: string }) => r.to),
  ];

  // Pulling onto a dirty tree can fail mid-merge or, with --force, discard work.
  if (dirtyFiles.length > 0) {
    logger.warning(`You have ${dirtyFiles.length} uncommitted change(s):`);
    for (const file of dirtyFiles.slice(0, 10)) {
      console.log(chalk.dim(`  ${file}`));
    }
    if (dirtyFiles.length > 10) {
      console.log(chalk.dim(`  ...and ${dirtyFiles.length - 10} more`));
    }
    logger.newline();

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: options.force
          ? 'Force pull will DISCARD these local changes. Continue?'
          : 'Pull anyway? The merge may conflict with these changes.',
        default: false,
      },
    ]);

    if (!proceed) {
      logger.info('Pull cancelled');
      return;
    }
  }

  const strategy = options.rebase ? 'rebase' : 'merge';
  const spinner = ora({
    text: chalk.cyan(`Pulling ${branch} from origin (${strategy})...`),
    spinner: 'dots',
  }).start();

  try {
    await git.pull({ rebase: options.rebase, force: options.force });
    spinner.succeed(chalk.green(`Pulled ${branch} from origin`));
  } catch (error: any) {
    spinner.fail(chalk.red('Pull failed'));
    logger.error(error.message);

    if (/conflict/i.test(error.message)) {
      logger.info('Resolve the conflicts, then run: git add . && git rebase --continue');
    }
    process.exit(1);
  }
}

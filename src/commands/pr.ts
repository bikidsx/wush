import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { Octokit } from '@octokit/rest';
import { GitService } from '../services/git.js';
import { createAIProvider } from '../services/ai/factory.js';
import { logger } from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

interface PROptions {
  target?: string;
}

export async function prCommand(options: PROptions): Promise<void> {
  const git = new GitService();
  const config = getConfig();

  // Check if in git repo
  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  // Check GitHub token
  if (!config.github.token) {
    logger.error('GitHub token not configured. Run: wush config');
    process.exit(1);
  }

  const currentBranch = await git.getCurrentBranch();
  
  // Determine target branch
  let targetBranch = options.target;
  if (!targetBranch) {
    const { branch } = await inquirer.prompt([
      {
        type: 'list',
        name: 'branch',
        message: 'Select target branch:',
        choices: ['main', 'master', 'dev', 'develop', 'staging'],
        default: config.github.defaultBranch,
      },
    ]);
    targetBranch = branch;
  }

  const spinner = ora(`Analyzing commits since ${targetBranch}...`).start();

  try {
    const commits = await git.getCommitsSince(targetBranch!);
    
    if (commits.length === 0) {
      spinner.stop();
      logger.warning(`No commits found since ${targetBranch}`);
      process.exit(0);
    }

    spinner.text = 'Generating PR description...';
    
    const diff = await git.getStagedDiff();
    const ai = createAIProvider();
    const response = await ai.generatePRDescription(commits, diff || '');
    
    spinner.stop();

    // Parse title and body from response
    const lines = response.content.split('\n');
    const title = lines[0].replace(/^#\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
    const body = lines.slice(1).join('\n').trim();

    logger.newline();
    logger.info(`Found ${commits.length} commits`);
    logger.newline();
    console.log(chalk.bold('Title:'), chalk.cyan(title));
    console.log(chalk.bold('\nDescription:'));
    console.log(chalk.dim(body));
    logger.newline();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create PR', value: 'create' },
          { name: 'Edit', value: 'edit' },
          { name: 'Preview on GitHub', value: 'preview' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ]);

    switch (action) {
      case 'create':
        await createPR(config.github.token, currentBranch, targetBranch!, title, body);
        break;
      case 'edit':
        const { editedTitle, editedBody } = await inquirer.prompt([
          {
            type: 'input',
            name: 'editedTitle',
            message: 'PR Title:',
            default: title,
          },
          {
            type: 'editor',
            name: 'editedBody',
            message: 'PR Description:',
            default: body,
          },
        ]);
        await createPR(config.github.token, currentBranch, targetBranch!, editedTitle, editedBody);
        break;
      case 'preview':
        logger.info('Opening GitHub...');
        // Would open browser here
        break;
      case 'cancel':
        logger.info('PR creation cancelled');
        break;
    }
  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed: ${error.message}`);
    process.exit(1);
  }
}

async function createPR(token: string, head: string, base: string, title: string, body: string): Promise<void> {
  const spinner = ora('Creating PR...').start();
  
  try {
    const octokit = new Octokit({ auth: token });
    
    // Get repo info from git remote
    const { execSync } = await import('child_process');
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    
    if (!match) {
      throw new Error('Could not parse GitHub repository from remote URL');
    }

    const [, owner, repo] = match;

    const { data: pr } = await octokit.pulls.create({
      owner,
      repo: repo.replace('.git', ''),
      title,
      body,
      head,
      base,
    });

    spinner.stop();
    logger.success(`PR created: ${pr.html_url}`);
  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to create PR: ${error.message}`);
  }
}

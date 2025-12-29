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
  
  // Get all branches
  const branchSummary = await git.getBranches();
  const allBranches = branchSummary.all
    .filter(b => b !== currentBranch && !b.startsWith('remotes/'))
    .map(b => b.replace('origin/', ''));
  
  // Also get remote branches
  const remoteBranches = branchSummary.all
    .filter(b => b.startsWith('remotes/origin/') && !b.includes('HEAD'))
    .map(b => b.replace('remotes/origin/', ''))
    .filter(b => b !== currentBranch);
  
  // Combine and dedupe
  const availableBranches = [...new Set([...allBranches, ...remoteBranches])];
  
  // Determine target branch
  let targetBranch = options.target;
  if (!targetBranch) {
    if (availableBranches.length === 0) {
      logger.error('No other branches found to create PR against');
      process.exit(1);
    }

    // Sort with common branches first
    const priorityBranches = ['main', 'master', 'dev', 'develop', 'staging'];
    const sortedBranches = availableBranches.sort((a, b) => {
      const aIndex = priorityBranches.indexOf(a);
      const bIndex = priorityBranches.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    const { branch } = await inquirer.prompt([
      {
        type: 'list',
        name: 'branch',
        message: `Select target branch (current: ${chalk.cyan(currentBranch)}):`,
        choices: sortedBranches,
        default: sortedBranches.find(b => b === config.github.defaultBranch) || sortedBranches[0],
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
    
    const customInstructions = config.instructions?.pr || '';
    // Get diff between current branch and target branch (not staged diff)
    const diff = await git.getDiffBetweenBranches(targetBranch!);
    const ai = createAIProvider();
    const response = await ai.generatePRDescription(commits, diff || '', {
      customInstructions
    });
    
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
    const git = new GitService();
    const remoteUrl = await git.getRemoteUrl();
    
    if (!remoteUrl) {
      spinner.stop();
      logger.error('No remote origin found. Please add a remote first:');
      console.log(chalk.dim('  git remote add origin https://github.com/username/repo.git'));
      return;
    }
    
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    
    if (!match) {
      spinner.stop();
      logger.error('Could not parse GitHub repository from remote URL');
      logger.info(`Remote URL: ${remoteUrl}`);
      return;
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
    if (error.status === 422) {
      logger.error('PR already exists or branch has no changes');
    } else if (error.status === 401) {
      logger.error('Invalid GitHub token. Run: wush config');
    } else {
      logger.error(`Failed to create PR: ${error.message}`);
    }
  }
}

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import { GitService } from '../services/git.js';
import { createAIProvider } from '../services/ai/factory.js';
import { logger } from '../utils/logger.js';

interface BranchOptions {
  name?: string;
  type?: string;
}

const BRANCH_TYPES = [
  { name: 'feature - New feature', value: 'feature', prefix: 'feature/' },
  { name: 'fix - Bug fix', value: 'fix', prefix: 'fix/' },
  { name: 'hotfix - Urgent fix', value: 'hotfix', prefix: 'hotfix/' },
  { name: 'release - Release branch', value: 'release', prefix: 'release/' },
  { name: 'chore - Maintenance', value: 'chore', prefix: 'chore/' },
  { name: 'docs - Documentation', value: 'docs', prefix: 'docs/' },
  { name: 'refactor - Code refactoring', value: 'refactor', prefix: 'refactor/' },
  { name: 'test - Testing', value: 'test', prefix: 'test/' },
];

export async function branchCommand(options: BranchOptions): Promise<void> {
  const git = new GitService();

  if (!(await git.isGitRepository())) {
    logger.error('Not a git repository');
    process.exit(1);
  }

  // If name provided directly, create branch
  if (options.name) {
    await createBranch(git, options.name, options.type);
    return;
  }

  // Interactive mode
  const { mode } = await inquirer.prompt([
    {
      type: 'list',
      name: 'mode',
      message: 'How would you like to create a branch?',
      choices: [
        { name: '🤖 AI-generated name (describe your task)', value: 'ai' },
        { name: '📝 Manual name entry', value: 'manual' },
        { name: '📋 List existing branches', value: 'list' },
      ],
    },
  ]);

  switch (mode) {
    case 'ai':
      await createBranchWithAI(git);
      break;
    case 'manual':
      await createBranchManually(git);
      break;
    case 'list':
      await listBranches(git);
      break;
  }
}

async function createBranchWithAI(git: GitService): Promise<void> {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Select branch type:',
      choices: BRANCH_TYPES,
    },
  ]);

  const { description } = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: 'Describe what you\'ll work on:',
      validate: (input: string) => input.length > 0 || 'Description is required',
    },
  ]);

  const spinner = ora('Generating branch name...').start();

  try {
    const ai = createAIProvider();
    const response = await ai.generateBranchName(description, type);
    spinner.stop();

    const branchType = BRANCH_TYPES.find(t => t.value === type);
    const suggestedName = `${branchType?.prefix}${response.content.trim()}`;

    logger.newline();
    logger.info('Suggested branch name:');
    console.log(chalk.cyan(`  ${suggestedName}`));
    logger.newline();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Create this branch', value: 'create' },
          { name: 'Edit name', value: 'edit' },
          { name: 'Regenerate', value: 'regenerate' },
          { name: 'Cancel', value: 'cancel' },
        ],
      },
    ]);

    switch (action) {
      case 'create':
        await createBranch(git, suggestedName);
        break;
      case 'edit':
        const { editedName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'editedName',
            message: 'Branch name:',
            default: suggestedName,
          },
        ]);
        await createBranch(git, editedName);
        break;
      case 'regenerate':
        await createBranchWithAI(git);
        break;
      case 'cancel':
        logger.info('Cancelled');
        break;
    }
  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to generate branch name: ${error.message}`);
  }
}

async function createBranchManually(git: GitService): Promise<void> {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Select branch type:',
      choices: [...BRANCH_TYPES, { name: 'Custom (no prefix)', value: 'custom', prefix: '' }],
    },
  ]);

  const branchType = BRANCH_TYPES.find(t => t.value === type);
  const prefix = branchType?.prefix || '';

  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: `Branch name${prefix ? ` (will be prefixed with ${prefix})` : ''}:`,
      validate: (input: string) => {
        if (!input) return 'Branch name is required';
        if (!/^[a-zA-Z0-9_-]+$/.test(input)) return 'Use only letters, numbers, hyphens, and underscores';
        return true;
      },
    },
  ]);

  const fullName = `${prefix}${name}`;
  await createBranch(git, fullName);
}

async function createBranch(git: GitService, name: string, type?: string): Promise<void> {
  const spinner = ora(`Creating branch ${name}...`).start();

  try {
    await git.createBranch(name);
    spinner.stop();
    logger.success(`Created and switched to branch: ${chalk.cyan(name)}`);
  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to create branch: ${error.message}`);
  }
}

async function listBranches(git: GitService): Promise<void> {
  const spinner = ora('Fetching branches...').start();

  try {
    const branches = await git.getBranches();
    spinner.stop();

    logger.newline();
    console.log(chalk.bold('Branches:'));
    logger.newline();

    for (const branch of branches.all) {
      const isCurrent = branch === branches.current;
      const icon = isCurrent ? chalk.green('→') : ' ';
      const name = isCurrent ? chalk.green.bold(branch) : chalk.white(branch);
      console.log(`  ${icon} ${name}`);
    }

    logger.newline();

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Switch to a branch', value: 'switch' },
          { name: 'Create new branch', value: 'create' },
          { name: 'Delete a branch', value: 'delete' },
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'switch':
        const { switchTo } = await inquirer.prompt([
          {
            type: 'list',
            name: 'switchTo',
            message: 'Select branch:',
            choices: branches.all.filter(b => b !== branches.current),
          },
        ]);
        await git.checkout(switchTo);
        logger.success(`Switched to ${switchTo}`);
        break;
      case 'create':
        await createBranchManually(git);
        break;
      case 'delete':
        const { deleteBranch } = await inquirer.prompt([
          {
            type: 'list',
            name: 'deleteBranch',
            message: 'Select branch to delete:',
            choices: branches.all.filter(b => b !== branches.current),
          },
        ]);
        const { confirmDelete } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmDelete',
            message: `Delete branch ${deleteBranch}?`,
            default: false,
          },
        ]);
        if (confirmDelete) {
          await git.deleteBranch(deleteBranch);
          logger.success(`Deleted branch ${deleteBranch}`);
        }
        break;
    }
  } catch (error: any) {
    spinner.stop();
    logger.error(`Failed to list branches: ${error.message}`);
  }
}

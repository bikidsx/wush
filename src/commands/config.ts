import inquirer from 'inquirer';
import chalk from 'chalk';
import { config, getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import type { AIProvider } from '../types/index.js';

export async function configCommand(): Promise<void> {
  const currentConfig = getConfig();

  logger.newline();
  console.log(chalk.bold('Current Configuration:\n'));
  console.log(chalk.dim('AI Provider:'), chalk.cyan(currentConfig.ai.provider));
  console.log(chalk.dim('Model:'), chalk.cyan(currentConfig.ai.model));
  console.log(chalk.dim('Conventional Commits:'), currentConfig.git.conventionalCommits ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.dim('GitHub Connected:'), currentConfig.github.token ? chalk.green('yes') : chalk.red('no'));
  console.log(chalk.dim('Scan on Commit:'), currentConfig.security.scanOnCommit ? chalk.green('enabled') : chalk.red('disabled'));
  console.log(chalk.dim('Commit Instructions:'), currentConfig.instructions?.commit ? chalk.green('custom') : chalk.dim('default'));
  console.log(chalk.dim('PR Instructions:'), currentConfig.instructions?.pr ? chalk.green('custom') : chalk.dim('default'));
  logger.newline();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to configure?',
      choices: [
        { name: 'Change AI Provider', value: 'provider' },
        { name: 'Update API Key', value: 'apikey' },
        { name: 'Change Model', value: 'model' },
        { name: 'Git Settings', value: 'git' },
        { name: 'GitHub Token', value: 'github' },
        { name: 'Custom Instructions', value: 'instructions' },
        { name: 'Security Settings', value: 'security' },
        { name: 'Reset All', value: 'reset' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'provider':
      await changeProvider();
      break;
    case 'apikey':
      await updateApiKey();
      break;
    case 'model':
      await changeModel();
      break;
    case 'git':
      await configureGit();
      break;
    case 'github':
      await configureGitHub();
      break;
    case 'instructions':
      await configureInstructions();
      break;
    case 'security':
      await configureSecurity();
      break;
    case 'reset':
      config.clear();
      logger.success('Configuration reset to defaults');
      break;
  }
}

async function changeProvider(): Promise<void> {
  const { provider } = await inquirer.prompt<{ provider: AIProvider }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Select AI provider:',
      choices: [
        { name: 'OpenAI (GPT-5, GPT-5 mini, GPT-5 nano)', value: 'openai' },
        { name: 'Anthropic (Claude Sonnet 4.5, Haiku 4.5)', value: 'anthropic' },
        { name: 'Google (Gemini 2.5 Pro, Gemini 2.5 Flash)', value: 'google' },
        { name: 'Ollama (Local - Free)', value: 'ollama' },
        { name: 'Groq (Fast inference)', value: 'groq' },
      ],
    },
  ]);

  config.set('ai.provider', provider);
  
  // Set default model for provider
  const cfg = getConfig();
  const defaultModel = cfg.providers[provider].defaultModel;
  config.set('ai.model', defaultModel);

  logger.success(`Provider changed to ${provider}`);
}

async function updateApiKey(): Promise<void> {
  const cfg = getConfig();
  const provider = cfg.ai.provider;

  if (provider === 'ollama') {
    logger.info('Ollama does not require an API key');
    return;
  }

  const { apiKey } = await inquirer.prompt([
    {
      type: 'password',
      name: 'apiKey',
      message: `Enter your ${provider} API key:`,
      validate: (input: string) => input.length > 0 || 'API key is required',
    },
  ]);

  config.set(`providers.${provider}.apiKey`, apiKey);
  config.set('ai.apiKey', apiKey);
  logger.success('API key updated');
}

async function changeModel(): Promise<void> {
  const cfg = getConfig();
  const provider = cfg.ai.provider;
  const models = cfg.providers[provider].models;

  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select model:',
      choices: models,
    },
  ]);

  config.set('ai.model', model);
  logger.success(`Model changed to ${model}`);
}

async function configureGit(): Promise<void> {
  const { conventionalCommits, autoStage } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'conventionalCommits',
      message: 'Enable conventional commits?',
      default: true,
    },
    {
      type: 'confirm',
      name: 'autoStage',
      message: 'Auto-stage all changes before commit?',
      default: false,
    },
  ]);

  config.set('git.conventionalCommits', conventionalCommits);
  config.set('git.autoStage', autoStage);
  logger.success('Git settings updated');
}

async function configureGitHub(): Promise<void> {
  const { token, defaultBranch } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      message: 'Enter GitHub token:',
    },
    {
      type: 'input',
      name: 'defaultBranch',
      message: 'Default target branch for PRs:',
      default: 'main',
    },
  ]);

  if (token) {
    config.set('github.token', token);
  }
  config.set('github.defaultBranch', defaultBranch);
  logger.success('GitHub settings updated');
}

async function configureSecurity(): Promise<void> {
  const { scanOnCommit, blockOnHigh } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'scanOnCommit',
      message: 'Run security scan before each commit?',
      default: false,
    },
    {
      type: 'confirm',
      name: 'blockOnHigh',
      message: 'Block commits with HIGH severity issues?',
      default: true,
    },
  ]);

  config.set('security.scanOnCommit', scanOnCommit);
  config.set('security.severity.blockOnHigh', blockOnHigh);
  logger.success('Security settings updated');
}


async function configureInstructions(): Promise<void> {
  const cfg = getConfig();
  
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Which instructions to configure?',
      choices: [
        { name: 'Commit message instructions', value: 'commit' },
        { name: 'PR description instructions', value: 'pr' },
        { name: 'Clear all custom instructions', value: 'clear' },
      ],
    },
  ]);

  if (type === 'clear') {
    config.set('instructions.commit', '');
    config.set('instructions.pr', '');
    logger.success('Custom instructions cleared');
    return;
  }

  const currentInstruction = cfg.instructions?.[type as 'commit' | 'pr'] || '';
  
  console.log(chalk.dim('\nExamples of custom instructions:'));
  if (type === 'commit') {
    console.log(chalk.dim('  - "Always include ticket number like JIRA-123"'));
    console.log(chalk.dim('  - "Use emoji at the start of commit messages"'));
    console.log(chalk.dim('  - "Keep messages under 50 characters"'));
    console.log(chalk.dim('  - "Include the affected module in parentheses"'));
  } else {
    console.log(chalk.dim('  - "Always include a Testing section"'));
    console.log(chalk.dim('  - "Link related Jira tickets"'));
    console.log(chalk.dim('  - "Include screenshots for UI changes"'));
    console.log(chalk.dim('  - "Add deployment notes section"'));
  }
  logger.newline();

  const { instruction } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'instruction',
      message: `Enter custom ${type} instructions (leave empty for default):`,
      default: currentInstruction,
    },
  ]);

  config.set(`instructions.${type}`, instruction.trim());
  
  if (instruction.trim()) {
    logger.success(`Custom ${type} instructions saved`);
  } else {
    logger.info(`Using default ${type} instructions`);
  }
}

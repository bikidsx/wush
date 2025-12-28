import inquirer from 'inquirer';
import chalk from 'chalk';
import { config, getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { validateTemplate } from '../utils/templates.js';
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
        { name: 'Security Settings', value: 'security' },
        { name: 'Manage Templates', value: 'templates' },
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
    case 'security':
      await configureSecurity();
      break;
    case 'templates':
      await manageTemplates();
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

async function manageTemplates(): Promise<void> {
  const { templateType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'templateType',
      message: 'Manage templates for:',
      choices: [
        { name: 'Commit Messages', value: 'commit' },
        { name: 'Pull Requests', value: 'pr' },
        { name: 'Back to Main Menu', value: 'back' },
      ],
    },
  ]);

  if (templateType === 'back') return;

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: `Template actions for ${templateType}:`,
      choices: [
        { name: 'View/Set Active Template', value: 'view' },
        { name: 'Create New Template', value: 'create' },
        { name: 'Edit Template', value: 'edit' },
        { name: 'Delete Template', value: 'delete' },
        { name: 'View Variable Reference', value: 'reference' },
        { name: 'Back', value: 'back' },
      ],
    },
  ]);

  switch (action) {
    case 'view':
      await viewTemplates(templateType);
      break;
    case 'create':
      await createTemplate(templateType);
      break;
    case 'edit':
      await editTemplate(templateType);
      break;
    case 'delete':
      await deleteTemplate(templateType);
      break;
    case 'reference':
      viewVariableReference();
      await manageTemplates();
      break;
    case 'back':
      await manageTemplates();
      break;
  }
}

async function viewTemplates(type: 'commit' | 'pr'): Promise<void> {
  const cfg = getConfig();
  const templates = cfg.templates[type];
  const activeTemplate = type === 'commit' ? cfg.templates.activeCommitTemplate : cfg.templates.activePrTemplate;

  logger.newline();
  console.log(chalk.bold(`${type === 'commit' ? 'Commit' : 'PR'} Templates:\n`));
  
  for (const [name, content] of Object.entries(templates)) {
    const isActive = name === activeTemplate;
    console.log(`${isActive ? chalk.green('●') : ' '} ${chalk.cyan(name)}: ${chalk.dim(content.replace(/\n/g, '\\n'))}`);
  }
  logger.newline();

  const { newActive } = await inquirer.prompt([
    {
      type: 'list',
      name: 'newActive',
      message: 'Select active template:',
      choices: [...Object.keys(templates), 'Back'],
    },
  ]);

  if (newActive !== 'Back') {
    const key = type === 'commit' ? 'templates.activeCommitTemplate' : 'templates.activePrTemplate';
    config.set(key, newActive);
    logger.success(`Active ${type} template set to: ${newActive}`);
  }

  await manageTemplates();
}

async function createTemplate(type: 'commit' | 'pr'): Promise<void> {
  const { name, content } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Enter template name:',
      validate: (input: string) => input.length > 0 || 'Name is required',
    },
    {
      type: 'editor',
      name: 'content',
      message: 'Enter template content (use {variable} syntax):',
      validate: (input: string) => validateTemplate(input) || 'Invalid template syntax. Check your braces.',
    },
  ]);

  const cfg = getConfig();
  const templates = { ...cfg.templates[type], [name]: content };
  config.set(`templates.${type}`, templates);
  logger.success(`Template '${name}' created`);
  
  await manageTemplates();
}

async function editTemplate(type: 'commit' | 'pr'): Promise<void> {
  const cfg = getConfig();
  const templates = cfg.templates[type];
  const names = Object.keys(templates);

  if (names.length === 0) {
    logger.error('No templates available to edit');
    return manageTemplates();
  }

  const { name } = await inquirer.prompt([
    {
      type: 'list',
      name: 'name',
      message: 'Select template to edit:',
      choices: names,
    },
  ]);

  const { content } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'content',
      message: `Editing template '${name}':`,
      default: templates[name],
      validate: (input: string) => validateTemplate(input) || 'Invalid template syntax. Check your braces.',
    },
  ]);

  config.set(`templates.${type}.${name}`, content);
  logger.success(`Template '${name}' updated`);
  
  await manageTemplates();
}

async function deleteTemplate(type: 'commit' | 'pr'): Promise<void> {
  const cfg = getConfig();
  const templates = { ...cfg.templates[type] };
  const names = Object.keys(templates).filter(n => n !== 'default');

  if (names.length === 0) {
    logger.error('No custom templates available to delete');
    return manageTemplates();
  }

  const { name } = await inquirer.prompt([
    {
      type: 'list',
      name: 'name',
      message: 'Select template to delete:',
      choices: names,
    },
  ]);

  delete templates[name];
  config.set(`templates.${type}`, templates);

  // If we deleted the active template, reset to default
  const activeKey = type === 'commit' ? 'templates.activeCommitTemplate' : 'templates.activePrTemplate';
  if (cfg.templates[type === 'commit' ? 'activeCommitTemplate' : 'activePrTemplate'] === name) {
    config.set(activeKey, 'default');
  }

  logger.success(`Template '${name}' deleted`);
  await manageTemplates();
}

function viewVariableReference(): void {
  logger.newline();
  console.log(chalk.bold('Available Template Variables:'));
  console.log(chalk.cyan('{type}'), chalk.dim('- Commit type (feat, fix, etc.)'));
  console.log(chalk.cyan('{scope}'), chalk.dim('- Commit scope'));
  console.log(chalk.cyan('{summary}'), chalk.dim('- Short summary of changes'));
  console.log(chalk.cyan('{description}'), chalk.dim('- Detailed description'));
  console.log(chalk.cyan('{branch}'), chalk.dim('- Current branch name'));
  console.log(chalk.cyan('{ticketId}'), chalk.dim('- Ticket ID extracted from branch'));
  console.log(chalk.cyan('{changes}'), chalk.dim('- Staged changes (diff)'));
  logger.newline();
}

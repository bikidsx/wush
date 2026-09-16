import inquirer from 'inquirer';
import chalk from 'chalk';
import { config, getConfig, resetConfig, setProviderSettings } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import {
  addCustomProvider,
  configureProviderCredentials,
  runProviderWizard,
  selectModel,
} from '../utils/providerSetup.js';
import { availableProviders } from '../services/ai/model.js';
import { clearModelCache } from '../services/ai/models.js';

export async function configCommand(): Promise<void> {
  const cfg = getConfig();
  const providers = availableProviders(cfg);
  const active = providers.find((p) => p.id === cfg.ai.providerId);

  // Show whether the key comes from the environment, since that overrides config.
  const envKey = active?.envKeys.find((k) => process.env[k]?.trim());
  const keyStatus = envKey
    ? chalk.green(`from ${envKey}`)
    : cfg.providers?.[cfg.ai.providerId]?.apiKey
      ? chalk.green('stored')
      : active?.auth === 'none'
        ? chalk.dim('not needed')
        : chalk.red('missing');

  logger.newline();
  console.log(chalk.bold('Current Configuration:\n'));
  console.log(chalk.dim('Provider:'), chalk.cyan(active?.label ?? cfg.ai.providerId));
  console.log(chalk.dim('Model:'), chalk.cyan(cfg.ai.model || '(none selected)'));
  console.log(chalk.dim('API key:'), keyStatus);
  console.log(
    chalk.dim('Conventional Commits:'),
    cfg.git.conventionalCommits ? chalk.green('enabled') : chalk.red('disabled')
  );
  console.log(
    chalk.dim('GitHub:'),
    cfg.github.token || process.env.GITHUB_TOKEN ? chalk.green('connected') : chalk.red('no')
  );
  console.log(
    chalk.dim('Custom providers:'),
    (cfg.customProviders ?? []).length > 0
      ? chalk.cyan((cfg.customProviders ?? []).map((c) => c.label).join(', '))
      : chalk.dim('none')
  );
  logger.newline();

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to configure?',
      pageSize: 12,
      choices: [
        { name: 'Switch provider or model', value: 'provider' },
        { name: 'Change model only', value: 'model' },
        { name: 'Update credentials', value: 'credentials' },
        { name: 'Add a custom endpoint', value: 'custom' },
        { name: 'Remove a custom endpoint', value: 'removeCustom' },
        { name: 'Refresh model lists', value: 'refresh' },
        { name: 'Git settings', value: 'git' },
        { name: 'GitHub token', value: 'github' },
        { name: 'Custom instructions', value: 'instructions' },
        { name: 'Security settings', value: 'security' },
        { name: 'Interface settings', value: 'ui' },
        { name: 'Reset all', value: 'reset' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]);

  switch (action) {
    case 'provider':
      await runProviderWizard();
      break;
    case 'model': {
      const model = await selectModel(cfg.ai.providerId);
      config.set('ai.model', model);
      setProviderSettings(cfg.ai.providerId, { lastModel: model });
      logger.success(`Model changed to ${model}`);
      break;
    }
    case 'credentials':
      await configureProviderCredentials(cfg.ai.providerId);
      logger.success('Credentials updated');
      break;
    case 'custom':
      await addCustomProvider();
      break;
    case 'removeCustom':
      await removeCustomProvider();
      break;
    case 'refresh':
      clearModelCache();
      logger.success('Model cache cleared; lists refresh on next use');
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
    case 'ui':
      await configureUI();
      break;
    case 'reset': {
      const { confirmReset } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmReset',
          message: 'Reset all settings, including stored API keys and custom endpoints?',
          default: false,
        },
      ]);
      if (confirmReset) {
        resetConfig();
        logger.success('Configuration reset to defaults');
      } else {
        logger.info('Reset cancelled');
      }
      break;
    }
  }
}

async function removeCustomProvider(): Promise<void> {
  const customs = getConfig().customProviders ?? [];

  if (customs.length === 0) {
    logger.info('No custom providers configured');
    return;
  }

  const { id } = await inquirer.prompt([
    {
      type: 'list',
      name: 'id',
      message: 'Remove which custom endpoint?',
      choices: customs.map((c) => ({ name: `${c.label} (${c.baseUrl})`, value: c.id })),
    },
  ]);

  config.set(
    'customProviders',
    customs.filter((c) => c.id !== id)
  );
  clearModelCache(id);

  // Leaving the active provider pointing at a deleted endpoint would break every command.
  if (getConfig().ai.providerId === id) {
    logger.warning('That was your active provider — choose a replacement.');
    await runProviderWizard();
  } else {
    logger.success('Custom endpoint removed');
  }
}

async function configureGit(): Promise<void> {
  const { conventionalCommits, autoStage } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'conventionalCommits',
      message: 'Enable conventional commits?',
      default: getConfig().git.conventionalCommits,
    },
    {
      type: 'confirm',
      name: 'autoStage',
      message: 'Auto-stage all changes before commit?',
      default: getConfig().git.autoStage,
    },
  ]);

  config.set('git.conventionalCommits', conventionalCommits);
  config.set('git.autoStage', autoStage);
  logger.success('Git settings updated');
}

async function configureGitHub(): Promise<void> {
  if (process.env.GITHUB_TOKEN?.trim()) {
    logger.info('GITHUB_TOKEN is set in your environment and takes precedence.');
  }

  const { token, defaultBranch } = await inquirer.prompt([
    {
      type: 'password',
      name: 'token',
      mask: '*',
      message: 'Enter GitHub token (blank to keep current):',
    },
    {
      type: 'input',
      name: 'defaultBranch',
      message: 'Default target branch for PRs:',
      default: getConfig().github.defaultBranch,
    },
  ]);

  if (token?.trim()) config.set('github.token', token.trim());
  config.set('github.defaultBranch', defaultBranch.trim());
  logger.success('GitHub settings updated');
}

async function configureSecurity(): Promise<void> {
  const current = getConfig().security;

  const { scanOnCommit, blockOnHigh } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'scanOnCommit',
      message: 'Run security scan before each commit?',
      default: current.scanOnCommit,
    },
    {
      type: 'confirm',
      name: 'blockOnHigh',
      message: 'Block commits with HIGH severity issues?',
      default: current.severity.blockOnHigh,
    },
  ]);

  config.set('security.scanOnCommit', scanOnCommit);
  config.set('security.severity.blockOnHigh', blockOnHigh);
  logger.success('Security settings updated');
}

async function configureUI(): Promise<void> {
  const current = getConfig().ui;

  const { tui, showUsage, emoji } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'tui',
      message: 'Use the interactive full-screen interface?',
      default: current.tui,
    },
    {
      type: 'confirm',
      name: 'showUsage',
      message: 'Show token usage after each AI call?',
      default: current.showUsage,
    },
    {
      type: 'confirm',
      name: 'emoji',
      message: 'Use emoji in output?',
      default: current.emoji,
    },
  ]);

  config.set('ui.tui', tui);
  config.set('ui.showUsage', showUsage);
  config.set('ui.emoji', emoji);
  logger.success('Interface settings updated');
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

  const key = type as 'commit' | 'pr';
  console.log(chalk.dim('\nExamples:'));
  if (key === 'commit') {
    console.log(chalk.dim('  - "Always include the ticket number like JIRA-123"'));
    console.log(chalk.dim('  - "Keep subjects under 50 characters"'));
  } else {
    console.log(chalk.dim('  - "Always include a Testing section"'));
    console.log(chalk.dim('  - "Add deployment notes"'));
  }
  logger.newline();

  const { instruction } = await inquirer.prompt([
    {
      type: 'editor',
      name: 'instruction',
      message: `Enter custom ${key} instructions (leave empty for default):`,
      default: cfg.instructions?.[key] || '',
    },
  ]);

  config.set(`instructions.${key}`, instruction.trim());
  logger.success(
    instruction.trim() ? `Custom ${key} instructions saved` : `Using default ${key} instructions`
  );
}

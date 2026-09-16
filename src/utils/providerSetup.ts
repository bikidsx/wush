/**
 * Shared provider/model selection.
 *
 * Both first-run setup and `wush config` call these. Previously each kept its
 * own hardcoded `inquirer` choice list, and the two had already drifted —
 * neither offered Azure even though the config supported it.
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { availableProviders } from '../services/ai/model.js';
import { listModels } from '../services/ai/models.js';
import { config, getConfig, setProviderSettings } from './config.js';
import { logger } from './logger.js';
import type { CustomProvider } from '../types/index.js';

/** True when a key for this provider is already present in the environment. */
function envKeyPresent(envKeys: string[]): string | undefined {
  return envKeys.find((key) => process.env[key]?.trim());
}

export async function selectProvider(): Promise<string> {
  const providers = availableProviders();

  const { providerId } = await inquirer.prompt<{ providerId: string }>([
    {
      type: 'list',
      name: 'providerId',
      message: 'Select AI provider:',
      pageSize: 12,
      choices: [
        ...providers.map((p) => {
          const envKey = envKeyPresent(p.envKeys);
          const badge = envKey
            ? chalk.green(` (${envKey} detected)`)
            : p.auth === 'none'
              ? chalk.dim(' (no key needed)')
              : '';
          return {
            name: `${p.label}${badge} ${chalk.dim('— ' + p.description)}`,
            value: p.id,
          };
        }),
        new inquirer.Separator(),
        { name: chalk.cyan('+ Add a custom endpoint'), value: '__add_custom__' },
      ],
    },
  ]);

  if (providerId === '__add_custom__') {
    const custom = await addCustomProvider();
    return custom.id;
  }
  return providerId;
}

/** Collects whatever credentials the chosen provider actually requires. */
export async function configureProviderCredentials(providerId: string): Promise<void> {
  const definition = availableProviders().find((p) => p.id === providerId);
  if (!definition) return;

  const existing = getConfig().providers?.[providerId] ?? {};
  const envKey = envKeyPresent(definition.envKeys);

  if (envKey) {
    logger.info(`Using ${envKey} from your environment — nothing to store.`);
  } else if (definition.auth === 'api-key') {
    const { apiKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'apiKey',
        mask: '*',
        message: `Enter your ${definition.label} API key:`,
        default: existing.apiKey || undefined,
        validate: (input: string) => input.trim().length > 0 || 'API key is required',
      },
    ]);
    setProviderSettings(providerId, { apiKey: apiKey.trim() });

    if (definition.envKeys.length > 0) {
      logger.dim(
        `  Tip: export ${definition.envKeys[0]} instead to keep the key out of the config file.`
      );
    }
  }

  if (definition.requiresBaseUrl || definition.id === 'ollama') {
    const { baseUrl } = await inquirer.prompt([
      {
        type: 'input',
        name: 'baseUrl',
        message: 'Endpoint base URL:',
        default: existing.baseUrl || definition.defaultBaseUrl,
        validate: (input: string) =>
          /^https?:\/\//.test(input.trim()) || 'Must start with http:// or https://',
      },
    ]);
    setProviderSettings(providerId, { baseUrl: baseUrl.trim() });
  }

  if (definition.id === 'azure') {
    const { resourceName, apiVersion } = await inquirer.prompt([
      {
        type: 'input',
        name: 'resourceName',
        message: 'Azure resource name:',
        default: existing.resourceName,
        validate: (input: string) => input.trim().length > 0 || 'Resource name is required',
      },
      {
        type: 'input',
        name: 'apiVersion',
        message: 'Azure API version:',
        default: existing.apiVersion || '2024-10-21',
      },
    ]);
    setProviderSettings(providerId, {
      resourceName: resourceName.trim(),
      apiVersion: apiVersion.trim(),
    });
  }
}

/**
 * Model picker backed by live discovery, with free-text entry so a brand new
 * model id works the day it ships even if listing has not caught up.
 */
export async function selectModel(providerId: string): Promise<string> {
  const definition = availableProviders().find((p) => p.id === providerId);
  const spinner = ora(chalk.cyan('Fetching available models...')).start();

  let includeAll = false;
  let { models, source, hiddenCount } = await listModels(providerId);
  spinner.stop();

  for (;;) {
    if (source === 'fallback' && models.length === 0) {
      const { model } = await inquirer.prompt([
        {
          type: 'input',
          name: 'model',
          message:
            definition?.id === 'azure'
              ? 'Azure deployment name:'
              : 'Model id (could not list models automatically):',
          validate: (input: string) => input.trim().length > 0 || 'A model id is required',
        },
      ]);
      return model.trim();
    }

    if (source === 'cache') logger.dim('  Using cached model list.');
    if (source === 'fallback') logger.dim('  Could not reach the provider; showing known ids.');
    if (hiddenCount > 0 && !includeAll) {
      logger.dim(`  ${hiddenCount} deprecated or non-text model(s) hidden.`);
    }

    const { model } = await inquirer.prompt([
      {
        type: 'list',
        name: 'model',
        message: 'Select model:',
        pageSize: 15,
        loop: false,
        choices: [
          ...models.map((m) => ({
            name: formatModelChoice(m),
            value: m.id,
          })),
          new inquirer.Separator(),
          { name: chalk.cyan('Enter a model id manually...'), value: '__manual__' },
          ...(hiddenCount > 0 && !includeAll
            ? [{ name: chalk.cyan(`Show all (${hiddenCount} hidden)`), value: '__all__' }]
            : []),
          { name: chalk.cyan('Refresh list'), value: '__refresh__' },
        ],
      },
    ]);

    if (model === '__manual__') {
      const { manual } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manual',
          message: 'Model id:',
          validate: (input: string) => input.trim().length > 0 || 'A model id is required',
        },
      ]);
      return manual.trim();
    }

    if (model === '__all__') {
      includeAll = true;
      // Served from cache, so revealing hidden entries costs no request.
      ({ models, source, hiddenCount } = await listModels(providerId, { includeAll: true }));
      continue;
    }

    if (model === '__refresh__') {
      const refreshing = ora(chalk.cyan('Refreshing...')).start();
      ({ models, source, hiddenCount } = await listModels(providerId, {
        refresh: true,
        includeAll,
      }));
      refreshing.stop();
      continue;
    }

    return model;
  }
}

/** Renders a model row with its capability and deprecation state. */
function formatModelChoice(model: {
  id: string;
  label?: string;
  kind?: string;
  deprecated?: boolean;
  deprecationNote?: string;
}): string {
  const parts: string[] = [];

  if (model.deprecated) {
    parts.push(chalk.yellow(model.deprecationNote ? `deprecated: ${model.deprecationNote}` : 'deprecated'));
  }
  if (model.kind && model.kind !== 'language' && model.kind !== 'unknown') {
    parts.push(chalk.magenta(model.kind));
  }
  if (model.label && model.label !== model.id) {
    parts.push(chalk.dim(model.label));
  }

  return parts.length > 0 ? `${model.id} ${chalk.dim('—')} ${parts.join(chalk.dim(' · '))}` : model.id;
}

/** Registers a user-defined OpenAI-compatible endpoint. */
export async function addCustomProvider(): Promise<CustomProvider> {
  logger.newline();
  logger.info('Add any OpenAI-compatible endpoint (LM Studio, OpenRouter, vLLM, LiteLLM, ...)');

  const answers = await inquirer.prompt<{
    label: string;
    baseUrl: string;
    apiKeyEnv: string;
    apiKey: string;
    supportsStructuredOutputs: boolean;
  }>([
    {
      type: 'input',
      name: 'label',
      message: 'Display name:',
      validate: (input: string) => input.trim().length > 0 || 'A name is required',
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: 'Base URL (including /v1 if required):',
      validate: (input: string) =>
        /^https?:\/\//.test(input.trim()) || 'Must start with http:// or https://',
    },
    {
      type: 'input',
      name: 'apiKeyEnv',
      message: 'Environment variable holding the API key (blank to enter it now):',
    },
    {
      type: 'password',
      name: 'apiKey',
      mask: '*',
      message: 'API key (leave blank if the endpoint needs none):',
      when: (a) => !a.apiKeyEnv?.trim(),
    },
    {
      type: 'confirm',
      name: 'supportsStructuredOutputs',
      message: 'Does this endpoint support strict JSON schema output?',
      default: true,
    },
  ]);

  // Derive a stable, filesystem/config-safe id from the display name.
  const baseId = answers.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'custom';

  const existing = getConfig().customProviders ?? [];
  let id = baseId;
  let suffix = 2;
  while (existing.some((c) => c.id === id) || availableProviders().some((p) => p.id === id)) {
    id = `${baseId}-${suffix++}`;
  }

  const custom: CustomProvider = {
    id,
    label: answers.label.trim(),
    baseUrl: answers.baseUrl.trim(),
    apiKeyEnv: answers.apiKeyEnv?.trim() || undefined,
    supportsStructuredOutputs: answers.supportsStructuredOutputs,
  };

  config.set('customProviders', [...existing, custom]);

  if (answers.apiKey?.trim()) {
    setProviderSettings(id, { apiKey: answers.apiKey.trim(), baseUrl: custom.baseUrl });
  } else {
    setProviderSettings(id, { baseUrl: custom.baseUrl });
  }

  logger.success(`Added custom provider "${custom.label}"`);
  return custom;
}

/** Full provider + credentials + model flow, shared by setup and config. */
export async function runProviderWizard(): Promise<void> {
  const providerId = await selectProvider();
  await configureProviderCredentials(providerId);
  const model = await selectModel(providerId);

  config.set('ai.providerId', providerId);
  config.set('ai.model', model);
  setProviderSettings(providerId, { lastModel: model });

  const label = availableProviders().find((p) => p.id === providerId)?.label ?? providerId;
  logger.success(`Using ${label} · ${model}`);
}

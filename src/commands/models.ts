import chalk from 'chalk';
import ora from 'ora';
import { availableProviders } from '../services/ai/model.js';
import { clearModelCache, listModels } from '../services/ai/models.js';
import { getConfig } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { toFriendlyError } from '../services/ai/errors.js';

interface ModelsOptions {
  provider?: string;
  refresh?: boolean;
  all?: boolean;
}

/** Lists what the configured (or requested) provider currently offers. */
export async function modelsCommand(options: ModelsOptions): Promise<void> {
  const cfg = getConfig();
  const providerId = options.provider ?? cfg.ai.providerId;
  const definition = availableProviders(cfg).find((p) => p.id === providerId);

  if (!definition) {
    logger.error(`Unknown provider "${providerId}"`);
    logger.dim(
      `  Available: ${availableProviders(cfg)
        .map((p) => p.id)
        .join(', ')}`
    );
    process.exit(1);
  }

  if (options.refresh) clearModelCache(providerId);

  const spinner = ora(chalk.cyan(`Fetching models from ${definition.label}...`)).start();

  try {
    const { models, source, hiddenCount } = await listModels(providerId, {
      refresh: options.refresh,
      includeAll: options.all,
    });
    spinner.stop();

    logger.newline();
    console.log(chalk.bold(definition.label), chalk.dim(`(${models.length} models)`));

    if (source !== 'live') {
      logger.dim(
        source === 'cache'
          ? '  Cached list — pass --refresh to update.'
          : '  Could not reach the provider; showing known ids.'
      );
    }
    if (hiddenCount > 0) {
      logger.dim(
        `  ${hiddenCount} deprecated or non-text model${hiddenCount === 1 ? '' : 's'} hidden — pass --all to show.`
      );
    }
    logger.newline();

    if (models.length === 0) {
      logger.warning('No models reported.');
      if (definition.discovery.kind === 'none') {
        logger.dim('  This provider does not expose a model list; enter the id manually.');
      }
      return;
    }

    for (const model of models) {
      const active = model.id === cfg.ai.model && providerId === cfg.ai.providerId;
      const marker = active ? chalk.green('→') : ' ';

      const tags: string[] = [];
      if (model.deprecated) {
        tags.push(chalk.yellow(model.deprecationNote ? `deprecated: ${model.deprecationNote}` : 'deprecated'));
      }
      if (model.kind && model.kind !== 'language' && model.kind !== 'unknown') {
        tags.push(chalk.magenta(model.kind));
      }
      if (model.label && model.label !== model.id) tags.push(chalk.dim(model.label));

      const suffix = tags.length > 0 ? `  ${tags.join(chalk.dim(' · '))}` : '';
      console.log(`  ${marker} ${active ? chalk.green.bold(model.id) : model.id}${suffix}`);
    }
    logger.newline();
  } catch (error) {
    spinner.stop();
    const friendly = toFriendlyError(error, { providerLabel: definition.label });
    logger.error(friendly.message);
    if (friendly.hint) logger.dim(`  ${friendly.hint}`);
    process.exit(1);
  }
}

/** Lists every provider and whether it is ready to use. */
export function providersCommand(): void {
  const cfg = getConfig();

  logger.newline();
  console.log(chalk.bold('AI providers\n'));

  for (const provider of availableProviders(cfg)) {
    const active = provider.id === cfg.ai.providerId;
    const envKey = provider.envKeys.find((k) => process.env[k]?.trim());
    const stored = cfg.providers?.[provider.id]?.apiKey;

    const ready =
      provider.auth === 'none'
        ? chalk.green('ready')
        : envKey
          ? chalk.green(`ready (${envKey})`)
          : stored
            ? chalk.green('ready (stored key)')
            : chalk.dim('needs a key');

    const marker = active ? chalk.green('→') : ' ';
    const name = active ? chalk.green.bold(provider.label) : provider.label;

    console.log(`  ${marker} ${name} ${chalk.dim(`[${provider.id}]`)}  ${ready}`);
    console.log(chalk.dim(`      ${provider.description}`));
  }

  logger.newline();
  logger.dim('  Run `wush config` to switch providers or add a custom endpoint.');
  logger.newline();
}

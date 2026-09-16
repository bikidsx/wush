import inquirer from 'inquirer';
import { config } from './config.js';
import { logger } from './logger.js';
import { runProviderWizard } from './providerSetup.js';

export async function runSetup(): Promise<void> {
  logger.title('\n👋 Welcome to Wush!\n');
  logger.info("Let's get you set up.\n");

  // Provider, credentials, and model in one shared flow.
  await runProviderWizard();

  const { conventionalCommits } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'conventionalCommits',
      message: 'Enable conventional commits?',
      default: true,
    },
  ]);
  config.set('git.conventionalCommits', conventionalCommits);

  const { connectGitHub } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'connectGitHub',
      message: 'Connect to GitHub for PR features?',
      default: true,
    },
  ]);

  if (connectGitHub) {
    // Respect an existing token in the environment rather than asking again.
    if (process.env.GITHUB_TOKEN?.trim()) {
      logger.info('Using GITHUB_TOKEN from your environment.');
    } else {
      const { githubToken } = await inquirer.prompt([
        {
          type: 'password',
          name: 'githubToken',
          mask: '*',
          message: 'Enter your GitHub token:',
          validate: (input: string) => input.trim().length > 0 || 'GitHub token is required',
        },
      ]);
      config.set('github.token', githubToken.trim());
    }
  }

  config.set('setupComplete', true);
  logger.success('\n✅ Setup complete!\n');
}

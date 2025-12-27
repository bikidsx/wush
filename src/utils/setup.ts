import inquirer from 'inquirer';
import { config } from './config.js';
import { logger } from './logger.js';
import type { AIProvider } from '../types/index.js';

export async function runSetup(): Promise<void> {
  logger.title('\n👋 Welcome to Wush!\n');
  logger.info("Let's get you set up.\n");

  // Select AI provider
  const { provider } = await inquirer.prompt<{ provider: AIProvider }>([
    {
      type: 'list',
      name: 'provider',
      message: 'Select your AI provider:',
      choices: [
        { name: 'OpenAI (GPT-5, GPT-5 mini, GPT-5 nano)', value: 'openai' },
        { name: 'Anthropic (Claude Sonnet 4.5, Haiku 4.5)', value: 'anthropic' },
        { name: 'Google (Gemini 2.5 Pro, Gemini 2.5 Flash)', value: 'google' },
        { name: 'Ollama (Local - Free: Llama 3.3 70B, Qwen3 72B)', value: 'ollama' },
        { name: 'Groq (Fast inference: gpt-oss-120B, Llama 4)', value: 'groq' },
      ],
    },
  ]);

  config.set('ai.provider', provider);

  // Get API key (skip for Ollama)
  if (provider !== 'ollama') {
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
  }

  // Select model
  const models = config.get(`providers.${provider}.models`) as string[];
  const { model } = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: 'Select default model:',
      choices: models,
    },
  ]);
  config.set('ai.model', model);
  config.set(`providers.${provider}.defaultModel`, model);

  // Git preferences
  const { conventionalCommits } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'conventionalCommits',
      message: 'Enable conventional commits?',
      default: true,
    },
  ]);
  config.set('git.conventionalCommits', conventionalCommits);

  // GitHub integration
  const { connectGitHub } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'connectGitHub',
      message: 'Connect to GitHub for PR features?',
      default: true,
    },
  ]);

  if (connectGitHub) {
    const { githubToken } = await inquirer.prompt([
      {
        type: 'password',
        name: 'githubToken',
        message: 'Enter your GitHub token:',
        validate: (input: string) => input.length > 0 || 'GitHub token is required',
      },
    ]);
    config.set('github.token', githubToken);
  }

  config.set('setupComplete', true);
  logger.success('\n✅ Setup complete!\n');
}

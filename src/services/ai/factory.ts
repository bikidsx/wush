import { BaseAIProvider } from './base.js';
import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { OllamaProvider } from './ollama.js';
import { GroqProvider } from './groq.js';
import { AzureOpenAIProvider } from './azure.js';
import type { AIProvider } from '../../types/index.js';
import { getConfig } from '../../utils/config.js';

export function createAIProvider(provider?: AIProvider): BaseAIProvider {
  const cfg = getConfig();
  const p = provider || cfg.ai.provider;
  const providerConfig = cfg.providers[p];
  const model = cfg.ai.model || providerConfig.defaultModel;

  switch (p) {
    case 'openai':
      return new OpenAIProvider(cfg.providers.openai.apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(cfg.providers.anthropic.apiKey, model);
    case 'google':
      return new GoogleProvider(cfg.providers.google.apiKey, model);
    case 'ollama':
      return new OllamaProvider(cfg.providers.ollama.baseUrl, model);
    case 'groq':
      return new GroqProvider(cfg.providers.groq.apiKey, model);
    case 'azure':
      return new AzureOpenAIProvider(
        cfg.providers.azure.apiKey,
        model,
        cfg.providers.azure.endpoint,
        cfg.providers.azure.apiVersion
      );
    default:
      return new OpenAIProvider(cfg.providers.openai.apiKey, model);
  }
}

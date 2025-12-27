import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base.js';
import { getSystemPrompt, buildCommitPrompt, buildPRPrompt, buildSecurityPrompt } from './prompts.js';
import type { AIResponse } from '../../types/index.js';

export class AnthropicProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(apiKey: string, model: string) {
    super(apiKey, model);
    this.client = new Anthropic({ apiKey });
  }

  async generateCommitMessage(diff: string): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 300,
      system: getSystemPrompt('commit'),
      messages: [
        { role: 'user', content: buildCommitPrompt(diff, { conventional: true }) },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content,
      model: this.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async generatePRDescription(commits: string[], diff: string): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1000,
      system: getSystemPrompt('pr'),
      messages: [
        { role: 'user', content: buildPRPrompt(commits, diff) },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content,
      model: this.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async analyzeSecurityIssues(code: string, filename: string): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 2000,
      system: getSystemPrompt('security'),
      messages: [
        { role: 'user', content: buildSecurityPrompt(code, filename) },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content,
      model: this.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }

  async generateBranchName(description: string, type: string): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 50,
      system: 'You generate short, descriptive git branch names. Use lowercase, hyphens for spaces. Max 30 chars. Return ONLY the branch name, no prefix, no explanation.',
      messages: [
        { role: 'user', content: `Generate a ${type} branch name for: ${description}` },
      ],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return {
      content: content.trim(),
      model: this.model,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}

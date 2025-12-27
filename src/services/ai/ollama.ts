import { Ollama } from 'ollama';
import { BaseAIProvider } from './base.js';
import { getSystemPrompt, buildCommitPrompt, buildPRPrompt, buildSecurityPrompt } from './prompts.js';
import type { AIResponse } from '../../types/index.js';

export class OllamaProvider extends BaseAIProvider {
  private client: Ollama;

  constructor(baseUrl: string, model: string) {
    super('', model);
    this.client = new Ollama({ host: baseUrl });
  }

  async generateCommitMessage(diff: string): Promise<AIResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('commit') },
        { role: 'user', content: buildCommitPrompt(diff, { conventional: true }) },
      ],
    });

    return {
      content: response.message.content,
      model: this.model,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };
  }

  async generatePRDescription(commits: string[], diff: string): Promise<AIResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('pr') },
        { role: 'user', content: buildPRPrompt(commits, diff) },
      ],
    });

    return {
      content: response.message.content,
      model: this.model,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };
  }

  async analyzeSecurityIssues(code: string, filename: string): Promise<AIResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('security') },
        { role: 'user', content: buildSecurityPrompt(code, filename) },
      ],
    });

    return {
      content: response.message.content,
      model: this.model,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };
  }
}

import { Ollama } from 'ollama';
import { BaseAIProvider, type GenerateOptions } from './base.js';
import { getSystemPrompt, buildCommitPrompt, buildPRPrompt, buildSecurityPrompt } from './prompts.js';
import type { AIResponse } from '../../types/index.js';

export class OllamaProvider extends BaseAIProvider {
  private client: Ollama;

  constructor(baseUrl: string, model: string) {
    super('', model);
    this.client = new Ollama({ host: baseUrl });
  }

  async generateCommitMessage(diff: string, options?: GenerateOptions): Promise<AIResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('commit') },
        { role: 'user', content: buildCommitPrompt(diff, { 
          conventional: options?.conventional ?? true,
          customInstructions: options?.customInstructions 
        }) },
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

  async generatePRDescription(commits: string[], diff: string, options?: GenerateOptions): Promise<AIResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('pr') },
        { role: 'user', content: buildPRPrompt(commits, diff, {
          customInstructions: options?.customInstructions
        }) },
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

  async generateBranchName(description: string, type: string): Promise<AIResponse> {
    const response = await this.client.chat({
      model: this.model,
      messages: [
        { role: 'system', content: 'You generate short, descriptive git branch names. Use lowercase, hyphens for spaces. Max 30 chars. Return ONLY the branch name, no prefix, no explanation.' },
        { role: 'user', content: `Generate a ${type} branch name for: ${description}` },
      ],
    });

    return {
      content: response.message.content.trim(),
      model: this.model,
      usage: {
        promptTokens: response.prompt_eval_count || 0,
        completionTokens: response.eval_count || 0,
        totalTokens: (response.prompt_eval_count || 0) + (response.eval_count || 0),
      },
    };
  }
}

import Groq from 'groq-sdk';
import { BaseAIProvider, type GenerateOptions } from './base.js';
import { getSystemPrompt, buildCommitPrompt, buildPRPrompt, buildSecurityPrompt } from './prompts.js';
import type { AIResponse } from '../../types/index.js';

export class GroqProvider extends BaseAIProvider {
  private client: Groq;

  constructor(apiKey: string, model: string) {
    super(apiKey, model);
    this.client = new Groq({ apiKey });
  }

  async generateCommitMessage(diff: string, options?: GenerateOptions): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('commit') },
        { role: 'user', content: buildCommitPrompt(diff, { 
          conventional: options?.conventional ?? true,
          customInstructions: options?.customInstructions 
        }) },
      ],
      temperature: 0.4,
      max_tokens: 300,
    });

    return {
      content: response.choices[0].message.content || '',
      model: this.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async generatePRDescription(commits: string[], diff: string, options?: GenerateOptions): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('pr') },
        { role: 'user', content: buildPRPrompt(commits, diff, {
          customInstructions: options?.customInstructions
        }) },
      ],
      temperature: 0.5,
      max_tokens: 1000,
    });

    return {
      content: response.choices[0].message.content || '',
      model: this.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async analyzeSecurityIssues(code: string, filename: string): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: getSystemPrompt('security') },
        { role: 'user', content: buildSecurityPrompt(code, filename) },
      ],
      temperature: 0.2,
      max_tokens: 2000,
    });

    return {
      content: response.choices[0].message.content || '',
      model: this.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }

  async generateBranchName(description: string, type: string): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: 'You generate short, descriptive git branch names. Use lowercase, hyphens for spaces. Max 30 chars. Return ONLY the branch name, no prefix, no explanation.' },
        { role: 'user', content: `Generate a ${type} branch name for: ${description}` },
      ],
      temperature: 0.7,
      max_tokens: 50,
    });

    return {
      content: (response.choices[0].message.content || '').trim(),
      model: this.model,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
    };
  }
}

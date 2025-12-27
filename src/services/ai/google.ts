import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseAIProvider } from './base.js';
import { getSystemPrompt, buildCommitPrompt, buildPRPrompt, buildSecurityPrompt } from './prompts.js';
import type { AIResponse } from '../../types/index.js';

export class GoogleProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string, model: string) {
    super(apiKey, model);
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateCommitMessage(diff: string): Promise<AIResponse> {
    const model = this.client.getGenerativeModel({ 
      model: this.model,
      systemInstruction: getSystemPrompt('commit'),
    });
    
    const result = await model.generateContent(buildCommitPrompt(diff, { conventional: true }));
    const response = result.response;

    return {
      content: response.text(),
      model: this.model,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async generatePRDescription(commits: string[], diff: string): Promise<AIResponse> {
    const model = this.client.getGenerativeModel({ 
      model: this.model,
      systemInstruction: getSystemPrompt('pr'),
    });
    
    const result = await model.generateContent(buildPRPrompt(commits, diff));
    const response = result.response;

    return {
      content: response.text(),
      model: this.model,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async analyzeSecurityIssues(code: string, filename: string): Promise<AIResponse> {
    const model = this.client.getGenerativeModel({ 
      model: this.model,
      systemInstruction: getSystemPrompt('security'),
    });
    
    const result = await model.generateContent(buildSecurityPrompt(code, filename));
    const response = result.response;

    return {
      content: response.text(),
      model: this.model,
      usage: {
        promptTokens: response.usageMetadata?.promptTokenCount || 0,
        completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: response.usageMetadata?.totalTokenCount || 0,
      },
    };
  }
}

import type { AIResponse } from '../../types/index.js';

export interface GenerateOptions {
  customInstructions?: string;
  conventional?: boolean;
}

export abstract class BaseAIProvider {
  protected apiKey: string;
  protected model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  abstract generateCommitMessage(diff: string, options?: GenerateOptions): Promise<AIResponse>;
  abstract generatePRDescription(commits: string[], diff: string, options?: GenerateOptions): Promise<AIResponse>;
  abstract analyzeSecurityIssues(code: string, filename: string): Promise<AIResponse>;
  abstract generateBranchName(description: string, type: string): Promise<AIResponse>;
}

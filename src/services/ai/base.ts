import type { AIResponse } from '../../types/index.js';

export abstract class BaseAIProvider {
  protected apiKey: string;
  protected model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  abstract generateCommitMessage(diff: string): Promise<AIResponse>;
  abstract generatePRDescription(commits: string[], diff: string): Promise<AIResponse>;
  abstract analyzeSecurityIssues(code: string, filename: string): Promise<AIResponse>;
}

import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { scanWithPatterns } from './patterns.js';
import { analyzeSecurityIssues } from '../ai/tasks.js';
import type { Vulnerability, ScanResult } from '../../types/index.js';
import { getConfig } from '../../utils/config.js';

const CODE_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rb', '.php', '.cs'];

export class SecurityScanner {
  private ignorePatterns: string[];

  constructor() {
    const config = getConfig();
    this.ignorePatterns = config.security.ignorePatterns;
  }

  async scanDirectory(dir: string): Promise<ScanResult> {
    const files = await this.getCodeFiles(dir);
    const allVulnerabilities: Vulnerability[] = [];

    for (const file of files) {
      const vulnerabilities = await this.scanFile(file);
      allVulnerabilities.push(...vulnerabilities);
    }

    return {
      vulnerabilities: allVulnerabilities,
      summary: {
        high: allVulnerabilities.filter(v => v.severity === 'HIGH').length,
        medium: allVulnerabilities.filter(v => v.severity === 'MEDIUM').length,
        low: allVulnerabilities.filter(v => v.severity === 'LOW').length,
      },
    };
  }

  async scanFile(filepath: string): Promise<Vulnerability[]> {
    try {
      const code = await readFile(filepath, 'utf-8');
      return scanWithPatterns(code, filepath);
    } catch {
      return [];
    }
  }

  async scanWithAI(filepath: string): Promise<Vulnerability[]> {
    try {
      const code = await readFile(filepath, 'utf-8');
      const result = await analyzeSecurityIssues(code, filepath);

      // Schema-validated by the SDK, so no JSON recovery from prose is needed.
      return result.value.findings.map((f) => ({
        severity: f.severity,
        type: f.type,
        file: filepath,
        line: f.line,
        description: f.description,
        fix: f.fix,
      }));
    } catch {
      return [];
    }
  }

  private async getCodeFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip common non-code directories
      if (entry.isDirectory()) {
        if (['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '__pycache__'].includes(entry.name)) {
          continue;
        }
        const subFiles = await this.getCodeFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = extname(entry.name);
        if (CODE_EXTENSIONS.includes(ext) && !this.shouldIgnore(entry.name)) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  private shouldIgnore(filename: string): boolean {
    return this.ignorePatterns.some(pattern => {
      const regex = new RegExp(pattern.replace('*', '.*'));
      return regex.test(filename);
    });
  }
}

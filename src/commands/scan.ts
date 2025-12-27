import ora from 'ora';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { SecurityScanner } from '../services/security/scanner.js';
import { logger } from '../utils/logger.js';
import type { Vulnerability } from '../types/index.js';

interface ScanOptions {
  ai?: boolean;
  path?: string;
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  const targetPath = options.path || process.cwd();
  const scanner = new SecurityScanner();

  const spinner = ora('Scanning codebase for vulnerabilities...').start();

  try {
    const result = await scanner.scanDirectory(targetPath);
    spinner.stop();

    if (result.vulnerabilities.length === 0) {
      logger.success('No vulnerabilities found!');
      return;
    }

    logger.newline();
    logger.warning(`Found ${result.vulnerabilities.length} potential vulnerabilities`);
    logger.newline();

    // Group by severity
    const high = result.vulnerabilities.filter(v => v.severity === 'HIGH');
    const medium = result.vulnerabilities.filter(v => v.severity === 'MEDIUM');
    const low = result.vulnerabilities.filter(v => v.severity === 'LOW');

    // Display vulnerabilities
    if (high.length > 0) {
      console.log(chalk.red.bold('\n🔴 HIGH SEVERITY'));
      displayVulnerabilities(high);
    }

    if (medium.length > 0) {
      console.log(chalk.yellow.bold('\n🟡 MEDIUM SEVERITY'));
      displayVulnerabilities(medium);
    }

    if (low.length > 0) {
      console.log(chalk.blue.bold('\n🔵 LOW SEVERITY'));
      displayVulnerabilities(low);
    }

    logger.summary(result.summary.high, result.summary.medium, result.summary.low);
    logger.newline();

    // Prompt for action
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Generate report', value: 'report' },
          { name: 'Show details', value: 'details' },
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    switch (action) {
      case 'report':
        generateReport(result.vulnerabilities);
        break;
      case 'details':
        showDetails(result.vulnerabilities);
        break;
    }
  } catch (error: any) {
    spinner.stop();
    logger.error(`Scan failed: ${error.message}`);
    process.exit(1);
  }
}

function displayVulnerabilities(vulnerabilities: Vulnerability[]): void {
  for (const vuln of vulnerabilities) {
    const color = vuln.severity === 'HIGH' ? 'red' : vuln.severity === 'MEDIUM' ? 'yellow' : 'blue';
    console.log(chalk[color](`  • ${vuln.type}`));
    console.log(chalk.dim(`    ${vuln.file}${vuln.line ? `:${vuln.line}` : ''}`));
    if (vuln.code) {
      console.log(chalk.gray(`    ${vuln.code.substring(0, 60)}${vuln.code.length > 60 ? '...' : ''}`));
    }
  }
}

function showDetails(vulnerabilities: Vulnerability[]): void {
  console.log('\n' + chalk.bold('Detailed Findings:\n'));
  
  for (const vuln of vulnerabilities) {
    logger.vulnerability(
      vuln.severity,
      vuln.type,
      vuln.file,
      vuln.line || 0,
      vuln.description,
      vuln.fix || 'Review and fix manually'
    );
  }
}

function generateReport(vulnerabilities: Vulnerability[]): void {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: vulnerabilities.length,
      high: vulnerabilities.filter(v => v.severity === 'HIGH').length,
      medium: vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
      low: vulnerabilities.filter(v => v.severity === 'LOW').length,
    },
    findings: vulnerabilities,
  };

  const filename = `security-report-${Date.now()}.json`;
  Bun.write(filename, JSON.stringify(report, null, 2));
  logger.success(`Report saved to ${filename}`);
}

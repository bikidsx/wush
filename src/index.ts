#!/usr/bin/env node
import { Command } from 'commander';
import { logger } from './utils/logger.js';
import { isSetupComplete } from './utils/config.js';
import { runSetup } from './utils/setup.js';
import { commitCommand } from './commands/commit.js';
import { prCommand } from './commands/pr.js';
import { pushCommand } from './commands/push.js';
import { scanCommand } from './commands/scan.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config.js';
import { branchCommand } from './commands/branch.js';

const program = new Command();

program
  .name('wush')
  .description('AI-powered Git workflow CLI')
  .version('1.0.0');

// Middleware to check setup
async function ensureSetup(): Promise<void> {
  if (!isSetupComplete()) {
    logger.banner();
    await runSetup();
  }
}

// Commit command
program
  .command('commit')
  .alias('c')
  .description('Generate AI-powered commit message')
  .action(async () => {
    await ensureSetup();
    await commitCommand();
  });

// PR command
program
  .command('pr')
  .description('Create a pull request')
  .option('--dev', 'Target dev branch')
  .option('--main', 'Target main branch')
  .option('--staging', 'Target staging branch')
  .option('-t, --target <branch>', 'Target branch')
  .action(async (options) => {
    await ensureSetup();
    let target = options.target;
    if (options.dev) target = 'dev';
    if (options.main) target = 'main';
    if (options.staging) target = 'staging';
    await prCommand({ target });
  });

// Scan command
program
  .command('scan')
  .alias('s')
  .description('Scan for security vulnerabilities')
  .option('--ai', 'Use AI for deeper analysis')
  .option('-p, --path <path>', 'Path to scan')
  .action(async (options) => {
    await ensureSetup();
    await scanCommand(options);
  });

// Status command
program
  .command('status')
  .description('Show enhanced git status')
  .action(async () => {
    await ensureSetup();
    await statusCommand();
  });

// Branch command
program
  .command('branch')
  .alias('b')
  .description('Create a new branch with AI-generated name')
  .option('-n, --name <name>', 'Branch name')
  .option('-t, --type <type>', 'Branch type (feature, fix, hotfix, etc.)')
  .action(async (options) => {
    await ensureSetup();
    await branchCommand(options);
  });

// Push command
program
  .command('push')
  .alias('p')
  .description('Push changes to remote')
  .option('-f, --force', 'Force push (use with caution)')
  .option('-u, --upstream', 'Set upstream branch')
  .action(async (options) => {
    await pushCommand(options);
  });

// Config command
program
  .command('config')
  .description('Configure wush settings')
  .action(async () => {
    await configCommand();
  });

// Default action (show help with banner)
program
  .action(() => {
    logger.banner();
    program.help();
  });

program.parse();

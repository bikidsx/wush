import chalk from 'chalk';
import gradient from 'gradient-string';
import figures from 'figures';

const wushGradient = gradient(['#ff6b6b', '#4ecdc4', '#45b7d1']);

export const logger = {
  success(message: string): void {
    console.log(chalk.green(`${figures.tick} ${message}`));
  },

  error(message: string): void {
    console.log(chalk.red(`${figures.cross} ${message}`));
  },

  warning(message: string): void {
    console.log(chalk.yellow(`${figures.warning} ${message}`));
  },

  info(message: string): void {
    console.log(chalk.blue(`${figures.info} ${message}`));
  },

  dim(message: string): void {
    console.log(chalk.dim(message));
  },

  title(message: string): void {
    console.log(wushGradient.multiline(message));
  },

  banner(): void {
    const banner = `
 ██╗    ██╗██╗   ██╗███████╗██╗  ██╗
 ██║    ██║██║   ██║██╔════╝██║  ██║
 ██║ █╗ ██║██║   ██║███████╗███████║
 ██║███╗██║██║   ██║╚════██║██╔══██║
 ╚███╔███╔╝╚██████╔╝███████║██║  ██║
  ╚══╝╚══╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝`;
    console.log(wushGradient.multiline(banner));
    console.log(chalk.dim('  AI-powered Git workflow\n'));
  },

  box(title: string, content: string, color: 'green' | 'yellow' | 'red' | 'blue' | 'cyan' = 'cyan'): void {
    const width = 60;
    const border = chalk[color]('─'.repeat(width));
    console.log(`\n┌${border}┐`);
    console.log(`│ ${chalk.bold[color](title.padEnd(width - 1))}│`);
    console.log(`├${border}┤`);
    content.split('\n').forEach(line => {
      console.log(`│ ${line.padEnd(width - 1)}│`);
    });
    console.log(`└${border}┘`);
  },

  vulnerability(severity: 'HIGH' | 'MEDIUM' | 'LOW', title: string, file: string, line: number, issue: string, fix: string): void {
    const color = severity === 'HIGH' ? 'red' : severity === 'MEDIUM' ? 'yellow' : 'blue';
    const icon = severity === 'HIGH' ? figures.cross : severity === 'MEDIUM' ? figures.warning : figures.info;
    
    console.log(chalk[color](`\n${icon} ${chalk.bold(`${severity}: ${title}`)}`));
    console.log(chalk.dim(`   File: ${file}:${line}`));
    console.log(chalk.white(`   Issue: ${issue}`));
    console.log(chalk.green(`   Fix: ${fix}`));
  },

  summary(high: number, medium: number, low: number): void {
    console.log('\n📝 Summary:');
    console.log(`   ${chalk.red(`High: ${high}`)}  ${chalk.yellow(`Medium: ${medium}`)}  ${chalk.blue(`Low: ${low}`)}`);
  },

  newline(): void {
    console.log();
  },
};

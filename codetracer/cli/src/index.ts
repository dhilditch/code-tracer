#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import { scanCommand } from './commands/scan';
import { annotateCommand } from './commands/annotate';
import { visualizeCommand } from './commands/visualize';

// Create CLI program
const program = new Command();

// Set version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

program
  .name('codetracer')
  .description('Command line tool for tracing code relationships and updating @usedby annotations')
  .version(packageInfo.version);

// Register commands
scanCommand(program);
annotateCommand(program);
visualizeCommand(program);

// Add global options
program
  .option('-c, --config <path>', 'path to config file')
  .option('-v, --verbose', 'enable verbose output');

// Handle unknown commands
program.on('command:*', () => {
  console.error(chalk.red(`Invalid command: ${program.args.join(' ')}`));
  console.error(`See ${chalk.cyan('--help')} for a list of available commands.`);
  process.exit(1);
});

// Parse arguments and execute command
program.parse(process.argv);

// If no arguments, show help
if (process.argv.length === 2) {
  program.help();
}
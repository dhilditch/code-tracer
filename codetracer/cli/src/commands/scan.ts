import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import * as chalk from 'chalk';
import * as ora from 'ora';
import { Scanner, LanguageParser } from 'codetracer-core';
import { createParsers } from '../parsers';

interface ScanOptions {
  output?: string;
  exclude?: string[];
  include?: string[];
  depth?: 'basic' | 'deep';
  cache?: boolean;
  maxFiles?: number;
}

export function scanCommand(program: Command): void {
  program
    .command('scan')
    .description('Scan the workspace for code relationships')
    .argument('[path]', 'path to scan (defaults to current directory)', '.')
    .option('-o, --output <path>', 'output file for scan results (JSON format)')
    .option('-e, --exclude <patterns...>', 'file patterns to exclude', ['node_modules/**', 'vendor/**', 'dist/**', 'build/**'])
    .option('-i, --include <patterns...>', 'file patterns to include', ['**/*.php', '**/*.js', '**/*.css'])
    .option('-d, --depth <level>', 'scan depth (basic or deep)', 'basic')
    .option('-n, --no-cache', 'disable caching of scan results')
    .option('-m, --max-files <number>', 'maximum number of files to scan', '1000')
    .action(async (scanPath: string, options: ScanOptions) => {
      try {
        const spinner = ora('Scanning files...').start();
        
        const startTime = Date.now();
        const scanner = new Scanner();
        
        // Register parsers
        const parsers = createParsers();
        for (const [ext, parser] of Object.entries(parsers)) {
          scanner.registerParser(ext, parser);
        }
        
        // Resolve path
        const resolvedPath = path.resolve(process.cwd(), scanPath);
        
        // Validate path exists
        if (!fs.existsSync(resolvedPath)) {
          spinner.fail(`Path does not exist: ${resolvedPath}`);
          process.exit(1);
        }
        
        // Get file paths
        spinner.text = 'Finding files...';
        
        const includePatterns = options.include || ['**/*.php', '**/*.js', '**/*.css'];
        const excludePatterns = options.exclude || ['node_modules/**', 'vendor/**', 'dist/**', 'build/**'];
        
        // Create glob pattern
        const fileGlobs = includePatterns.map(pattern => 
          path.join(resolvedPath, pattern.startsWith('**') ? pattern : `**/${pattern}`)
        );
        
        let filePaths: string[] = [];
        
        for (const fileGlob of fileGlobs) {
          const files = glob.sync(fileGlob, {
            ignore: excludePatterns,
            absolute: true
          });
          filePaths = [...filePaths, ...files];
        }
        
        // Remove duplicates
        filePaths = [...new Set(filePaths)];
        
        // Limit the number of files if needed
        const maxFiles = parseInt(options.maxFiles as string) || 1000;
        if (filePaths.length > maxFiles) {
          spinner.info(`Limiting scan to ${maxFiles} files (out of ${filePaths.length} found)`);
          filePaths = filePaths.slice(0, maxFiles);
        }
        
        // Batch files for processing
        const batchSize = 50;
        const batches = [];
        for (let i = 0; i < filePaths.length; i += batchSize) {
          batches.push(filePaths.slice(i, i + batchSize));
        }
        
        // Process batches
        let totalSymbols = 0;
        let totalUsages = 0;
        let batchNumber = 0;
        
        for (const batch of batches) {
          batchNumber++;
          spinner.text = `Processing batch ${batchNumber}/${batches.length} (${batch.length} files)...`;
          
          // Read files and process
          const files = await Promise.all(
            batch.map(async (filePath) => {
              try {
                const content = fs.readFileSync(filePath, 'utf8');
                return { path: filePath, content };
              } catch (err) {
                console.error(`Error reading file ${filePath}:`, err);
                return null;
              }
            })
          );
          
          // Filter out nulls
          const validFiles = files.filter(Boolean) as { path: string; content: string }[];
          
          // Process batch
          const result = await scanner.processBatch(validFiles, {
            includePatterns,
            excludePatterns,
            scanDepth: options.depth,
            maxFilesToScan: maxFiles,
            cacheResults: options.cache !== false
          });
          
          totalSymbols += result.symbolsFound;
          totalUsages += result.usagesFound;
        }
        
        // Complete
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        spinner.succeed(`Scan completed in ${duration}s`);
        
        // Display results
        console.log(`\n${chalk.green('✓')} Scanned ${filePaths.length} files`);
        console.log(`${chalk.green('✓')} Found ${totalSymbols} symbols`);
        console.log(`${chalk.green('✓')} Found ${totalUsages} usages`);
        
        // Save results if output path specified
        if (options.output) {
          const outputPath = path.resolve(process.cwd(), options.output);
          const result = {
            symbols: Array.from(scanner['symbolCache'].values()),
            scanTime: Date.now() - startTime,
            filesScanned: filePaths.length,
            symbolsFound: totalSymbols,
            usagesFound: totalUsages
          };
          
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
          console.log(`\n${chalk.green('✓')} Results saved to ${outputPath}`);
        }
      } catch (error) {
        console.error(chalk.red('Error during scan:'), error);
        process.exit(1);
      }
    });
}
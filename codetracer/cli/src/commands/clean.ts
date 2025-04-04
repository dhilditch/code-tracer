import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import * as glob from 'glob';
import { Annotator } from 'codetracer-core';

interface CleanOptions {
  include?: string[];
  exclude?: string[];
  verbose?: boolean;
}

export function cleanCommand(program: Command): void {
  program
    .command('clean')
    .description('Remove @usedby annotations from source code')
    .argument('[path]', 'path to clean (defaults to current directory)', '.')
    .option('--include <patterns...>', 'file patterns to include', ['**/*.php', '**/*.js', '**/*.css', '**/*.ts'])
    .option('--exclude <patterns...>', 'file patterns to exclude', ['node_modules/**', 'vendor/**', 'dist/**', 'build/**'])
    .option('-v, --verbose', 'display detailed information about the process')
    .action(async (targetPath: string, options: CleanOptions) => {
      try {
        // Commander doesn't always correctly set the verbose flag from -v
        // We detect it manually from command line args to ensure it works
        const hasVerboseArg = process.argv.includes('--verbose') || process.argv.includes('-v');
        if (hasVerboseArg && !options.verbose) {
          options.verbose = true;
        }
        
        // Resolve target path
        const resolvedPath = path.resolve(process.cwd(), targetPath);
        
        // Check if path exists
        if (!fs.existsSync(resolvedPath)) {
          console.error(chalk.red(`Path does not exist: ${resolvedPath}`));
          process.exit(1);
        }
        
        const spinner = ora('Finding files to clean...').start();
        
        try {
          // Process similar to other commands
          const includePatterns = options.include || ['**/*.php', '**/*.js', '**/*.css', '**/*.ts'];
          const excludePatterns = options.exclude || ['node_modules/**', 'vendor/**', 'dist/**', 'build/**'];
          
          // Create glob pattern for finding files
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
          
          spinner.succeed(`Found ${filePaths.length} files to process`);
          
          // Create annotator to use its comment style utilities
          const annotator = new Annotator();
          
          // Track statistics
          let processedFiles = 0;
          let skippedFiles = 0;
          let updatedFiles = 0;
          let totalAnnotationsRemoved = 0;
          const updatedFilePaths: string[] = []; // Track updated file paths for verbose mode
          
          // Process each file
          spinner.text = 'Removing @usedby annotations...';
          spinner.start();
          
          for (const filePath of filePaths) {
            processedFiles++;
            
            if (processedFiles % 10 === 0) {
              spinner.text = `Removing @usedby annotations (${processedFiles}/${filePaths.length})...`;
            }
            
            // Read file content
            let content: string;
            try {
              content = fs.readFileSync(filePath, 'utf8');
            } catch (err) {
              if (options.verbose) {
                console.error(`Error reading file ${filePath}:`, err);
              }
              skippedFiles++;
              continue;
            }
            
            // If no @usedby in the content, skip
            if (!content.includes('@usedby')) {
              skippedFiles++;
              continue;
            }
            
            // Get file extension for determining comment style
            const fileExt = path.extname(filePath);
            const commentStyle = annotator.getCommentStyle(fileExt);
            
            // Split into lines for processing
            const lines = content.split('\n');
            const cleanedLines: string[] = [];
            
            let inCommentBlock = false;
            let blockStartLine = -1;
            let annotationsRemoved = 0;
            let fileUpdated = false;
            
            // Process line by line
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const trimmedLine = line.trim();
              
              // Detect comment block start
              if (trimmedLine.startsWith(commentStyle.blockStart)) {
                inCommentBlock = true;
                blockStartLine = i;
              }
              
              // Check if line contains @usedby and inside a comment block
              if (inCommentBlock && trimmedLine.includes('@usedby')) {
                // Skip this line (don't add to cleanedLines)
                annotationsRemoved++;
                fileUpdated = true;
                continue;
              }
              
              // Detect comment block end
              if (inCommentBlock && trimmedLine.endsWith(commentStyle.blockEnd)) {
                inCommentBlock = false;
              }
              
              // Add all other lines to the cleaned content
              cleanedLines.push(line);
            }
            
            // If we removed annotations, write the file
            if (fileUpdated) {
              try {
                fs.writeFileSync(filePath, cleanedLines.join('\n'));
                updatedFiles++;
                totalAnnotationsRemoved += annotationsRemoved;
                updatedFilePaths.push(filePath);
                
                if (options.verbose) {
                  spinner.text = `Removed ${annotationsRemoved} annotations from ${filePath}`;
                  console.log(chalk.dim(`  - ${filePath}: removed ${annotationsRemoved} annotations`));
                }
              } catch (err) {
                if (options.verbose) {
                  console.error(`Error writing file ${filePath}:`, err);
                }
              }
            } else {
              skippedFiles++;
            }
          }
          
          // Prepare success message
          let successMessage = '';
          if (updatedFiles > 0) {
            successMessage = `Removed ${totalAnnotationsRemoved} @usedby annotations from ${updatedFiles} files`;
            if (skippedFiles > 0) {
              successMessage += ` (${skippedFiles} files skipped)`;
            }
          } else {
            successMessage = `No @usedby annotations found in ${filePaths.length} files`;
          }
          
          spinner.succeed(successMessage);
          
          // Display updated files in verbose mode
          if (options.verbose && updatedFilePaths.length > 0) {
            console.log(chalk.cyan('\nUpdated files:'));
            console.log(chalk.dim('-------------------'));
            updatedFilePaths.forEach((filePath, index) => {
              console.log(`  ${index + 1}. ${filePath}`);
            });
            console.log(chalk.dim('-------------------'));
          }
          
        } catch (error) {
          spinner.fail('Cleaning failed');
          console.error(chalk.red('Error during cleaning:'), error);
          process.exit(1);
        }
      } catch (error) {
        console.error(chalk.red('Error during cleaning:'), error);
        process.exit(1);
      }
    });
}
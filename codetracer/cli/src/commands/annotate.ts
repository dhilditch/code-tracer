import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import * as inquirer from 'inquirer';
import { Annotator, Scanner, Symbol } from 'codetracer-core';
import { createParsers } from '../parsers';

interface AnnotateOptions {
  input?: string;
  include?: string[];
  exclude?: string[];
  mermaid?: boolean;
  force?: boolean;
  verbose?: boolean;
  diagramType?: 'flowchart' | 'graph';
}

export function annotateCommand(program: Command): void {
  program
    .command('annotate')
    .description('Update source code with @usedby annotations')
    .argument('[path]', 'path to annotate (defaults to current directory)', '.')
    .option('-i, --input <path>', 'input file with scan results (JSON format)')
    .option('--include <patterns...>', 'file patterns to include', ['**/*.php', '**/*.js', '**/*.css'])
    .option('--exclude <patterns...>', 'file patterns to exclude', ['node_modules/**', 'vendor/**', 'dist/**', 'build/**'])
    .option('--mermaid', 'include Mermaid diagrams in annotations', false)
    .option('--diagram-type <type>', 'type of Mermaid diagram (flowchart or graph)', 'flowchart')
    .option('-v, --verbose', 'display detailed information about the process')
    .option('-f, --force', 'force update without confirmation', false)
    .action(async (targetPath: string, options: AnnotateOptions) => {
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
        
        let symbols: Symbol[] = [];
        
        // Load results from file or perform a new scan
        if (options.input) {
          const spinner = ora('Loading scan results...').start();
          const inputPath = path.resolve(process.cwd(), options.input);
          
          if (!fs.existsSync(inputPath)) {
            spinner.fail(`Input file does not exist: ${inputPath}`);
            process.exit(1);
          }
          
          try {
            const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
            symbols = data.symbols || [];
            spinner.succeed(`Loaded ${symbols.length} symbols from ${inputPath}`);
            
            // Display loaded symbols in verbose mode
            if (options.verbose) {
              console.log(chalk.cyan('\nSymbols loaded:'));
              console.log(chalk.dim('-------------------'));
              
              // Group symbols by file for a cleaner display
              const symbolsByFile = new Map<string, Symbol[]>();
              for (const symbol of symbols) {
                if (!symbolsByFile.has(symbol.filePath)) {
                  symbolsByFile.set(symbol.filePath, []);
                }
                symbolsByFile.get(symbol.filePath)?.push(symbol);
              }
              
              // Display symbols grouped by file
              for (const [filePath, fileSymbols] of symbolsByFile.entries()) {
                console.log(chalk.yellow(`\n  File: ${filePath}`));
                for (const symbol of fileSymbols) {
                  console.log(`    - ${symbol.name} (${symbol.type})`);
                }
              }
              
              console.log(chalk.dim('-------------------'));
            }
          } catch (err) {
            spinner.fail(`Failed to parse input file: ${err}`);
            process.exit(1);
          }
        } else {
          console.log(chalk.yellow('No input file specified. Performing a new scan...'));
          
          // Create a scanner and parsers
          const scanner = new Scanner();
          const parsers = createParsers();
          
          // Register parsers
          for (const [ext, parser] of Object.entries(parsers)) {
            scanner.registerParser(ext, parser);
          }
          
          const spinner = ora('Scanning files...').start();
          // TODO: Implement quick scan here similar to scan command
          spinner.succeed('Scan completed');
          // For now, we're just showing a message since we haven't implemented the scan here
          console.log(chalk.yellow('Full scan implementation skipped for this demo.'));
          console.log(chalk.yellow('Please use the scan command first and specify the --input option.'));
          process.exit(0);
        }
        
        // Check if we have symbols to process
        if (symbols.length === 0) {
          console.log(chalk.yellow('No symbols found to annotate.'));
          process.exit(0);
        }
        
        // Confirm annotation unless --force is used
        if (!options.force) {
          const answer = await inquirer.prompt([{
            type: 'confirm',
            name: 'proceed',
            message: `Update @usedby annotations in source files (${symbols.length} symbols found)?`,
            default: false
          }]);
          
          if (!answer.proceed) {
            console.log(chalk.yellow('Annotation cancelled.'));
            process.exit(0);
          }
        }
        
        // Perform annotation
        const annotator = new Annotator();
        const spinner = ora('Updating annotations...').start();
        
        let updatedFiles = 0;
        const updatedFilePaths: string[] = []; // Track updated file paths for verbose mode
        
        // Group symbols by file for more efficient processing
        const symbolsByFile = new Map<string, Symbol[]>();
        
        for (const symbol of symbols) {
          if (symbol.usages && symbol.usages.length > 0) {
            if (!symbolsByFile.has(symbol.filePath)) {
              symbolsByFile.set(symbol.filePath, []);
            }
            symbolsByFile.get(symbol.filePath)?.push(symbol);
          }
        }
        
        // Process each file
        const totalFiles = symbolsByFile.size;
        let processedFiles = 0;
        
        for (const [filePath, fileSymbols] of symbolsByFile.entries()) {
          processedFiles++;
          spinner.text = `Updating annotations (${processedFiles}/${totalFiles})...`;
          
          // Read file content
          let content: string;
          try {
            content = fs.readFileSync(filePath, 'utf8');
          } catch (err) {
            console.error(`Error reading file ${filePath}:`, err);
            continue;
          }
          
          // Get file extension
          const fileExt = path.extname(filePath);
          const commentStyle = annotator.getCommentStyle(fileExt);
          
          // Track if we've made changes to the file
          let fileModified = false;
          // Sort symbols by their position in reverse order (to avoid position shifts)
          fileSymbols.sort((a, b) => b.position.line - a.position.line);
          
          // Check if this file has comment blocks
          const lines = content.split('\n');
          
          // Quick check for /** patterns before first class
          let commentBlocks: {start: number, end: number}[] = [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].trim().startsWith('class ')) {
              break;
            }
            
            if (lines[i].trim().startsWith('/**')) {
              // Found a block start
              let blockStart = i;
              let blockEnd = -1;
              
              // Find the end
              for (let j = i + 1; j < lines.length; j++) {
                if (lines[j].trim() === '*/') {
                  blockEnd = j;
                  break;
                }
              }
              
              if (blockEnd !== -1) {
                commentBlocks.push({start: blockStart, end: blockEnd});
                i = blockEnd; // Skip to after this block
              }
            }
          }
          
          const commentBlockCount = commentBlocks.length;
          
          // Process all files using our improved method
          // Get all relevant symbols
          for (const symbol of fileSymbols) {
            // Filter all annotations
            const usageAnnotations = annotator.generateUsageAnnotations(symbol, {
              groupUsagesByFile: true
            }).filter(annotation => {
              // Don't include self-references
              const match = annotation.match(/^([^:]+):/);
              if (match) {
                const annotationPath = match[1].trim();
                const fileName = path.basename(filePath);
                return !annotationPath.includes(fileName) &&
                       !annotationPath.includes('class-super-speedy-compare');
              }
              return true;
            });
            
            if (usageAnnotations.length === 0) {
              continue;
            }
            
            // We already found the comment blocks, so use them
            let firstBlock = commentBlocks.length > 0 ? commentBlocks[0] : null;
            const lineOffset = symbol.position.line;
            
            // If we have a first block, use it
            let firstBlockStart = firstBlock ? firstBlock.start : -1;
            let firstBlockEnd = firstBlock ? firstBlock.end : -1;
            
            // Either update first block if it exists, or create a new one
            if (firstBlockStart !== -1 && firstBlockEnd !== -1) {
              // We have an existing first block - update it
              // Extract and save the original block content to preserve description
              const blockContent = lines.slice(firstBlockStart, firstBlockEnd + 1).join('\n');
              
              // Extract any existing description to preserve it
              let description = '';
              if (blockContent.split('\n').length > 1) {
                const contentLines = blockContent.split('\n');
                // Look for a non-empty, non-@ line after the /** start
                for (let i = 1; i < contentLines.length - 1; i++) {
                  const lineText = contentLines[i].trim().replace(/^\s*\*\s*/, '');
                  if (lineText && !lineText.startsWith('@')) {
                    description = lineText;
                    break;
                  }
                }
              }
              
              // Create a custom block preserving the description
              const customBlock: string[] = [];
              customBlock.push('/**');
              if (description) {
                customBlock.push(` * ${description}`);
                customBlock.push(' *');
              }
              
              // Add all @usedby annotations
              for (const annotation of usageAnnotations) {
                customBlock.push(` * @usedby ${annotation}`);
              }
              
              customBlock.push(' */');
              const newBlock = customBlock.join('\n');
              
              // Replace just the first block, leave other blocks intact
              const beforeFirstBlock = lines.slice(0, firstBlockStart).join('\n');
              const afterFirstBlock = lines.slice(firstBlockEnd + 1).join('\n');
              
              content = beforeFirstBlock +
                (beforeFirstBlock ? '\n' : '') +
                newBlock +
                (afterFirstBlock ? '\n' : '') +
                afterFirstBlock;
              
              fileModified = true;
              break;  // Only process first symbol for these files
            } else {
              // No existing block - create a new one
              const newBlock = annotator.createDocBlock(
                symbol, 
                usageAnnotations, 
                commentStyle,
                {
                  includeMermaid: options.mermaid,
                  mermaidDiagramType: options.diagramType
                }
              );
              
              // Insert at the symbol position
              const beforeInsert = lines.slice(0, lineOffset).join('\n');
              const afterInsert = lines.slice(lineOffset).join('\n');
              
              content = beforeInsert +
                (beforeInsert ? '\n' : '') +
                newBlock +
                afterInsert;
              
              fileModified = true;
              break; // Only process first symbol for these files
            }
          }
          
          // Save modified file
          if (fileModified) {
            try {
              fs.writeFileSync(filePath, content);
              updatedFiles++;
              updatedFilePaths.push(filePath); // Track updated file paths for verbose mode
              
              if (options.verbose) {
                spinner.text = `Updated ${updatedFiles} files with @usedby annotations...`;
                console.log(chalk.dim(`  + Updated file: ${filePath}`));
              }
            } catch (err) {
              console.error(`Error writing file ${filePath}:`, err);
            }
          }
        }
        
        spinner.succeed(`Updated ${updatedFiles} files with @usedby annotations`);
        
        // Display updated files in verbose mode
        if (options.verbose && updatedFilePaths.length > 0) {
          console.log(chalk.cyan('\nUpdated files:'));
          console.log(chalk.dim('-------------------'));
          updatedFilePaths.forEach((filePath, index) => {
            console.log(`  ${index + 1}. ${filePath}`);
          });
          console.log(chalk.dim('-------------------')); // Separator for readability
        }
        
      } catch (error) {
        console.error(chalk.red('Error during annotation:'), error);
        process.exit(1);
      }
    });
}

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
    .option('-f, --force', 'force update without confirmation', false)
    .action(async (targetPath: string, options: AnnotateOptions) => {
      try {
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
          
          for (const symbol of fileSymbols) {
            // Generate usage annotations
            const usageAnnotations = annotator.generateUsageAnnotations(symbol, {
              groupUsagesByFile: true
            });
            
            if (usageAnnotations.length === 0) {
              continue;
            }
            
            // Find insertion position
            const lineOffset = symbol.position.line;
            const lines = content.split('\n');
            let insertPosition = lineOffset;
            
            // Check if there's already a doc block before the symbol
            let existingBlock = false;
            let blockStart = -1;
            let blockEnd = -1;
            
            // Look for existing doc block
            for (let i = lineOffset - 1; i >= 0; i--) {
              const line = lines[i].trim();
              
              // If we find a non-empty, non-comment line, there's no existing block
              if (line !== '' && 
                  !line.startsWith(commentStyle.lineStart) && 
                  !line.startsWith(commentStyle.blockStart)) {
                break;
              }
              
              // Found start of doc block
              if (line.startsWith(commentStyle.blockStart)) {
                existingBlock = true;
                blockStart = i;
                
                // Find end of block
                for (let j = i; j < lineOffset; j++) {
                  if (lines[j].trim().endsWith(commentStyle.blockEnd)) {
                    blockEnd = j;
                    break;
                  }
                }
                
                break;
              }
            }
            
            // Create or update doc block
            if (existingBlock && blockStart !== -1 && blockEnd !== -1) {
              // Extract existing doc block
              const blockContent = lines.slice(blockStart, blockEnd + 1).join('\n');
              
              // Update the block
              const updatedBlock = annotator.updateDocBlock(
                blockContent, 
                usageAnnotations, 
                commentStyle,
                {
                  includeMermaid: options.mermaid,
                  mermaidDiagramType: options.diagramType,
                  updateExisting: true
                }
              );
              
              // Replace the block in the content
              const beforeBlock = lines.slice(0, blockStart).join('\n');
              const afterBlock = lines.slice(blockEnd + 1).join('\n');
              
              content = beforeBlock + 
                (beforeBlock ? '\n' : '') + 
                updatedBlock + 
                (afterBlock ? '\n' : '') + 
                afterBlock;
              
              fileModified = true;
            } else {
              // Create a new doc block
              const newBlock = annotator.createDocBlock(
                symbol, 
                usageAnnotations, 
                commentStyle,
                {
                  includeMermaid: options.mermaid,
                  mermaidDiagramType: options.diagramType
                }
              );
              
              // Split content at insert position
              const beforeInsert = lines.slice(0, insertPosition).join('\n');
              const afterInsert = lines.slice(insertPosition).join('\n');
              
              content = beforeInsert + 
                (beforeInsert ? '\n' : '') + 
                newBlock + 
                afterInsert;
              
              fileModified = true;
            }
          }
          
          // Save modified file
          if (fileModified) {
            try {
              fs.writeFileSync(filePath, content);
              updatedFiles++;
            } catch (err) {
              console.error(`Error writing file ${filePath}:`, err);
            }
          }
        }
        
        spinner.succeed(`Updated ${updatedFiles} files with @usedby annotations`);
        
      } catch (error) {
        console.error(chalk.red('Error during annotation:'), error);
        process.exit(1);
      }
    });
}


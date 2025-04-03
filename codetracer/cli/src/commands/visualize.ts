import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as chalk from 'chalk';
import ora from 'ora';
import * as inquirer from 'inquirer';
import { RelationshipGraph, Symbol } from 'codetracer-core';

interface VisualizeOptions {
  input?: string;
  output?: string;
  format?: 'mermaid' | 'svg' | 'json';
  direction?: 'LR' | 'TD' | 'RL' | 'BT';
  symbol?: string;
  maxNodes?: number;
  includeFiles?: boolean;
  targetTypes?: string[];
  noEdgeLabels?: boolean;
}

export function visualizeCommand(program: Command): void {
  program
    .command('visualize')
    .description('Generate visualizations of code relationships')
    .option('-i, --input <path>', 'input file with scan results (JSON format)')
    .option('-o, --output <path>', 'output file for visualization')
    .option('-f, --format <format>', 'output format (mermaid, svg, json)', 'mermaid')
    .option('-d, --direction <direction>', 'graph direction (LR, TD, RL, BT)', 'TD')
    .option('-s, --symbol <name>', 'focus on a specific symbol')
    .option('-m, --max-nodes <number>', 'maximum number of nodes to include', '50')
    .option('--include-files', 'include file nodes in the graph', false)
    .option('--target-types <types...>', 'filter symbols by type (class, function, method, etc.)')
    .option('--no-edge-labels', 'hide edge labels', false)
    .action(async (options: VisualizeOptions) => {
      try {
        // Check for input file
        if (!options.input) {
          console.error(chalk.red('Input file is required. Use --input to specify a scan results file.'));
          process.exit(1);
        }
        
        // Load scan results
        const spinner = ora('Loading scan results...').start();
        const inputPath = path.resolve(process.cwd(), options.input);
        
        if (!fs.existsSync(inputPath)) {
          spinner.fail(`Input file does not exist: ${inputPath}`);
          process.exit(1);
        }
        
        let symbols: Symbol[] = [];
        
        try {
          const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
          symbols = data.symbols || [];
          spinner.succeed(`Loaded ${symbols.length} symbols from ${inputPath}`);
        } catch (err) {
          spinner.fail(`Failed to parse input file: ${err}`);
          process.exit(1);
        }
        
        // Check if we have symbols to process
        if (symbols.length === 0) {
          console.log(chalk.yellow('No symbols found for visualization.'));
          process.exit(0);
        }
        
        // Filter symbols by type if specified
        if (options.targetTypes && options.targetTypes.length > 0) {
          symbols = symbols.filter(symbol => 
            options.targetTypes?.includes(symbol.type)
          );
          
          if (symbols.length === 0) {
            console.log(chalk.yellow(`No symbols found with types: ${options.targetTypes.join(', ')}`));
            process.exit(0);
          }
          
          console.log(chalk.green(`Filtered to ${symbols.length} symbols of types: ${options.targetTypes.join(', ')}`));
        }
        
        // Focus on a specific symbol if specified
        let targetSymbol: Symbol | undefined;
        
        if (options.symbol) {
          // Find the symbol by name
          targetSymbol = symbols.find(s => s.name === options.symbol);
          
          if (!targetSymbol) {
            // If exact match not found, suggest similar symbols
            const similarSymbols = symbols
              .filter(s => s.name.toLowerCase().includes(options.symbol!.toLowerCase()))
              .slice(0, 10);
            
            if (similarSymbols.length > 0) {
              console.log(chalk.yellow(`Symbol "${options.symbol}" not found. Did you mean one of these?`));
              
              const symbolChoice = await inquirer.prompt([{
                type: 'list',
                name: 'symbol',
                message: 'Select a symbol:',
                choices: similarSymbols.map(s => ({
                  name: `${s.name} (${s.type})`,
                  value: s
                }))
              }]);
              
              targetSymbol = symbolChoice.symbol;
            } else {
              console.error(chalk.red(`Symbol "${options.symbol}" not found.`));
              process.exit(1);
            }
          }
        }
        
        // Create graph
        spinner.text = 'Generating visualization...';
        const graph = new RelationshipGraph();
        
        // Parse options
        const maxNodes = parseInt(String(options.maxNodes || '50'));
        
        let result;
        if (targetSymbol) {
          // Generate graph for a specific symbol
          result = graph.buildSymbolGraph(targetSymbol, {
            includeFiles: options.includeFiles,
            direction: options.direction,
            edgeLabels: !options.noEdgeLabels
          });
          
          console.log(chalk.green(`Generated graph for symbol "${targetSymbol.name}" with ${result.nodes.length} nodes and ${result.edges.length} edges`));
        } else {
          // Generate graph for all symbols
          result = graph.buildGraph(symbols, {
            includeFiles: options.includeFiles,
            maxNodes: maxNodes,
            direction: options.direction,
            edgeLabels: !options.noEdgeLabels
          });
          
          if (result.nodes.length >= maxNodes) {
            console.log(chalk.yellow(`Graph limited to ${maxNodes} nodes. Use --max-nodes to increase limit.`));
          }
          
          console.log(chalk.green(`Generated graph with ${result.nodes.length} nodes and ${result.edges.length} edges`));
        }
        
        // Generate output
        let output: string = '';
        
        switch (options.format) {
          case 'mermaid':
            output = graph.generateMermaidDiagram(result, {
              direction: options.direction,
              edgeLabels: !options.noEdgeLabels
            });
            break;
            
          case 'json':
            output = JSON.stringify(result, null, 2);
            break;
            
          case 'svg':
            console.log(chalk.yellow('SVG output is not implemented in this demo version.'));
            output = graph.generateMermaidDiagram(result, {
              direction: options.direction,
              edgeLabels: !options.noEdgeLabels
            });
            console.log(chalk.yellow('Generated Mermaid diagram instead.'));
            break;
            
          default:
            output = graph.generateMermaidDiagram(result, {
              direction: options.direction,
              edgeLabels: !options.noEdgeLabels
            });
        }
        
        // Save or display output
        if (options.output) {
          const outputPath = path.resolve(process.cwd(), options.output);
          fs.writeFileSync(outputPath, output);
          spinner.succeed(`Visualization saved to ${outputPath}`);
        } else {
          spinner.succeed('Visualization generated');
          console.log('\nOutput:');
          console.log(output);
        }
        
      } catch (error) {
        console.error(chalk.red('Error during visualization:'), error);
        process.exit(1);
      }
    });
}
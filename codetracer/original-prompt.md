# CodeTracer VS Code Extension Development Prompt

Create a TypeScript-based VS Code extension called "CodeTracer" that implements the @usedby code documentation standard with the following features:

1. **Core Functionality**:
   - Parse PHP/JS/CSS files to identify classes, functions, and selectors
   - Scan workspace to find usages of these elements
   - Update or create comment blocks with @usedby annotations
   - Generate and embed Mermaid diagrams showing code relationships

2. **Extension Commands**:
   - `codetracer.scanWorkspace`: Scan entire workspace for code relationships
   - `codetracer.scanCurrentFile`: Update annotations for current file only
   - `codetracer.toggleMermaid`: Enable/disable Mermaid diagram generation
   - `codetracer.showUsages`: Show all usages of the currently selected symbol
   - `codetracer.navigateToUsage`: Jump to next/previous usage location

3. **Settings**:
   - Enable/disable automatic updates on save
   - Configure file types to scan
   - Set exclusion patterns
   - Control Mermaid diagram generation options

4. **UI Components**:
   - Status bar item showing scan status
   - Quick pick menu for navigating between usages
   - Webview panel for displaying full relationship graphs
   - Hover provider showing usage information

5. **Language Support**:
   - Start with PHP/WordPress focused implementation
   - Add JavaScript event handler detection
   - Include CSS selector tracking

6. **Performance Considerations**:
   - Implement incremental scanning for large workspaces
   - Support toggling Mermaid diagrams for better performance
   - Cache scan results for faster navigation

The extension should provide a smooth, non-intrusive workflow that helps developers understand code relationships without disrupting their coding experience.

codetracer/
├── extension/              # VS Code extension
│   ├── src/
│   │   ├── extension.ts    # Extension entry point
│   │   ├── scanner.ts      # Code scanning functionality
│   │   ├── annotator.ts    # Comment block management
│   │   ├── mermaid.ts      # Mermaid diagram generation
│   │   ├── parser/         # Language-specific parsers
│   │   │   ├── php.ts
│   │   │   ├── js.ts
│   │   │   └── css.ts
│   │   └── providers/      # VS Code UI providers
│   ├── package.json        # Extension manifest
│   └── tsconfig.json       # TypeScript configuration
│
├── cli/                    # Command line tool
│   ├── src/
│   │   ├── index.ts        # CLI entry point
│   │   └── commands/       # CLI commands
│   └── package.json        # CLI package config
│
└── core/                   # Shared functionality
    ├── src/
    │   ├── parser.ts       # Core parsing logic
    │   ├── scanner.ts      # Usage detection
    │   ├── annotator.ts    # Comment manipulation
    │   └── graph.ts        # Relationship graph building
    └── package.json        # Core package config

// extension.ts - Main extension entry point
import * as vscode from 'vscode';
import { CodeScanner } from './scanner';
import { CodeAnnotator } from './annotator';
import { MermaidGenerator } from './mermaid';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeTracer extension activated');
    
    const scanner = new CodeScanner();
    const annotator = new CodeAnnotator();
    const mermaidGenerator = new MermaidGenerator();
    
    // Status bar item to show scanning status
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(sync) CodeTracer";
    statusBarItem.tooltip = "CodeTracer: Click to scan workspace";
    statusBarItem.command = 'codetracer.scanWorkspace';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('codetracer.scanWorkspace', async () => {
            statusBarItem.text = "$(sync~spin) CodeTracer: Scanning...";
            
            try {
                const results = await scanner.scanWorkspace();
                await annotator.updateAnnotations(results);
                
                if (vscode.workspace.getConfiguration('codetracer').get('visualization.embedMermaid')) {
                    await mermaidGenerator.generateDiagrams(results);
                }
                
                vscode.window.showInformationMessage(`CodeTracer: Scanned ${results.length} files and updated annotations`);
                statusBarItem.text = "$(sync) CodeTracer";
            } catch (error) {
                vscode.window.showErrorMessage(`CodeTracer error: ${error.message}`);
                statusBarItem.text = "$(sync) CodeTracer (Error)";
            }
        }),
        
        vscode.commands.registerCommand('codetracer.scanCurrentFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('CodeTracer: No active file to scan');
                return;
            }
            
            try {
                const results = await scanner.scanFile(editor.document.uri);
                await annotator.updateAnnotations(results);
                
                if (vscode.workspace.getConfiguration('codetracer').get('visualization.embedMermaid')) {
                    await mermaidGenerator.generateDiagrams(results);
                }
                
                vscode.window.showInformationMessage(`CodeTracer: Updated annotations for ${editor.document.fileName}`);
            } catch (error) {
                vscode.window.showErrorMessage(`CodeTracer error: ${error.message}`);
            }
        }),
        
        vscode.commands.registerCommand('codetracer.toggleMermaid', async () => {
            const config = vscode.workspace.getConfiguration('codetracer');
            const currentValue = config.get('visualization.embedMermaid');
            
            await config.update('visualization.embedMermaid', !currentValue, true);
            vscode.window.showInformationMessage(
                `CodeTracer: Mermaid diagrams ${!currentValue ? 'enabled' : 'disabled'}`
            );
        }),
        
        vscode.commands.registerCommand('codetracer.showUsages', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            
            const position = editor.selection.active;
            const symbol = await scanner.getSymbolAtPosition(editor.document, position);
            
            if (!symbol) {
                vscode.window.showInformationMessage('CodeTracer: No symbol found at cursor position');
                return;
            }
            
            const usages = await scanner.findUsages(symbol);
            if (usages.length === 0) {
                vscode.window.showInformationMessage(`CodeTracer: No usages found for ${symbol.name}`);
                return;
            }
            
            // Show quick pick menu with usages
            const items = usages.map(usage => ({
                label: `$(file-code) ${usage.uri.path.split('/').pop()}`,
                description: `Line ${usage.range.start.line + 1}`,
                detail: usage.context,
                usage
            }));
            
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: `${usages.length} usages found for ${symbol.name}`
            });
            
            if (selected) {
                const doc = await vscode.workspace.openTextDocument(selected.usage.uri);
                const editor = await vscode.window.showTextDocument(doc);
                editor.revealRange(selected.usage.range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(
                    selected.usage.range.start,
                    selected.usage.range.start
                );
            }
        })
    );
    
    // Register file change watchers if auto-update is enabled
    if (vscode.workspace.getConfiguration('codetracer').get('annotations.updateOnSave')) {
        const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{php,js,css}');
        
        fileWatcher.onDidChange(async (uri) => {
            const results = await scanner.scanFile(uri);
            await annotator.updateAnnotations(results);
            
            if (vscode.workspace.getConfiguration('codetracer').get('visualization.embedMermaid')) {
                await mermaidGenerator.generateDiagrams(results);
            }
        });
        
        context.subscriptions.push(fileWatcher);
    }
}

export function deactivate() {
    // Clean up resources
}
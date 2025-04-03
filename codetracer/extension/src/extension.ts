import * as vscode from 'vscode';
import { CodeScanner } from './scanner';
import { CodeAnnotator } from './annotator';
import { MermaidGenerator } from './mermaid';
import { UsageNavigator } from './providers/usageNavigator';
import { HoverProvider } from './providers/hoverProvider';
import { WebviewProvider } from './providers/webviewProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('CodeTracer extension activated');
    
    const scanner = new CodeScanner();
    const annotator = new CodeAnnotator();
    const mermaidGenerator = new MermaidGenerator();
    const usageNavigator = new UsageNavigator(scanner);
    const webviewProvider = new WebviewProvider(context.extensionUri);
    
    // Status bar item to show scanning status
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(sync) CodeTracer";
    statusBarItem.tooltip = "CodeTracer: Click to scan workspace";
    statusBarItem.command = 'codetracer.scanWorkspace';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    
    // Register hover provider for PHP, JS, and CSS files
    const hoverProvider = new HoverProvider(scanner);
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(['php', 'javascript', 'css'], hoverProvider)
    );
    
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
                vscode.window.showErrorMessage(`CodeTracer error: ${error instanceof Error ? error.message : String(error)}`);
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
                vscode.window.showErrorMessage(`CodeTracer error: ${error instanceof Error ? error.message : String(error)}`);
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
                vscode.window.showWarningMessage('CodeTracer: No active editor to show usages');
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
        }),

        vscode.commands.registerCommand('codetracer.navigateToUsage', async () => {
            await usageNavigator.navigate();
        }),

        vscode.commands.registerCommand('codetracer.showRelationshipGraph', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('CodeTracer: No active file to show graph');
                return;
            }

            const document = editor.document;
            const position = editor.selection.active;
            const symbol = await scanner.getSymbolAtPosition(document, position);

            if (!symbol) {
                vscode.window.showInformationMessage('CodeTracer: No symbol found at cursor position');
                return;
            }

            // Generate a graph for the current symbol and display it in a webview
            const graphData = await mermaidGenerator.generateGraphForWebview(symbol);
            webviewProvider.showGraph(graphData, symbol.name);
        })
    );
    
    // Register file change watchers if auto-update is enabled
    if (vscode.workspace.getConfiguration('codetracer').get('annotations.updateOnSave')) {
        const fileGlobs = vscode.workspace.getConfiguration('codetracer').get('annotations.fileTypes') as string[];
        const fileWatcher = vscode.workspace.createFileSystemWatcher(`**/{${fileGlobs.join(',')}}`);
        
        fileWatcher.onDidChange(async (uri) => {
            try {
                const results = await scanner.scanFile(uri);
                await annotator.updateAnnotations(results);
                
                if (vscode.workspace.getConfiguration('codetracer').get('visualization.embedMermaid')) {
                    await mermaidGenerator.generateDiagrams(results);
                }
            } catch (error) {
                console.error('Error updating annotations:', error);
            }
        });
        
        context.subscriptions.push(fileWatcher);
    }
}

export function deactivate() {
    // Clean up resources
    console.log('CodeTracer extension deactivated');
}
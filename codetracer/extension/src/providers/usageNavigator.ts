import * as vscode from 'vscode';
import { CodeScanner, Symbol, Usage } from '../scanner';

/**
 * Provider for navigating between symbol usages
 */
export class UsageNavigator {
    private scanner: CodeScanner;
    private currentUsages: Usage[] = [];
    private currentIndex: number = -1;
    private currentSymbol: Symbol | undefined;
    
    constructor(scanner: CodeScanner) {
        this.scanner = scanner;
    }
    
    /**
     * Navigate to next/previous usage of the current symbol
     */
    async navigate(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('CodeTracer: No active editor to navigate');
            return;
        }
        
        // Get the current symbol at cursor
        const position = editor.selection.active;
        
        // If we don't have a current symbol, or cursor has moved, get a new one
        if (!this.currentSymbol || 
            this.currentSymbol.uri.fsPath !== editor.document.uri.fsPath ||
            !this.currentSymbol.range.contains(position)) {
            this.currentSymbol = await this.scanner.getSymbolAtPosition(editor.document, position);
            
            if (!this.currentSymbol) {
                vscode.window.showInformationMessage('CodeTracer: No symbol found at cursor position');
                return;
            }
            
            // Get all usages for this symbol
            this.currentUsages = await this.scanner.findUsages(this.currentSymbol);
            this.currentIndex = -1;
        }
        
        if (this.currentUsages.length === 0) {
            vscode.window.showInformationMessage(`CodeTracer: No usages found for ${this.currentSymbol.name}`);
            return;
        }
        
        // Show quick pick with navigation options
        const items = [
            { label: '$(arrow-right) Next Usage', action: 'next' },
            { label: '$(arrow-left) Previous Usage', action: 'previous' },
            { label: '$(list-ordered) Show All Usages', action: 'list' }
        ];
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `${this.currentUsages.length} usages found for ${this.currentSymbol.name}`
        });
        
        if (!selected) {
            return;
        }
        
        if (selected.action === 'next') {
            await this.navigateToNextUsage();
        } else if (selected.action === 'previous') {
            await this.navigateToPreviousUsage();
        } else if (selected.action === 'list') {
            await this.showUsagesList();
        }
    }
    
    /**
     * Navigate to the next usage in the list
     */
    private async navigateToNextUsage(): Promise<void> {
        if (this.currentUsages.length === 0) {
            return;
        }
        
        this.currentIndex = (this.currentIndex + 1) % this.currentUsages.length;
        await this.navigateToUsage(this.currentUsages[this.currentIndex]);
    }
    
    /**
     * Navigate to the previous usage in the list
     */
    private async navigateToPreviousUsage(): Promise<void> {
        if (this.currentUsages.length === 0) {
            return;
        }
        
        this.currentIndex = (this.currentIndex - 1 + this.currentUsages.length) % this.currentUsages.length;
        await this.navigateToUsage(this.currentUsages[this.currentIndex]);
    }
    
    /**
     * Navigate to a specific usage
     */
    private async navigateToUsage(usage: Usage): Promise<void> {
        try {
            const doc = await vscode.workspace.openTextDocument(usage.uri);
            const editor = await vscode.window.showTextDocument(doc);
            
            // Reveal and select the range
            editor.revealRange(usage.range, vscode.TextEditorRevealType.InCenter);
            editor.selection = new vscode.Selection(
                usage.range.start,
                usage.range.end
            );
            
            // Show a status bar message
            const currentUsageIndex = this.currentUsages.indexOf(usage) + 1;
            vscode.window.setStatusBarMessage(
                `CodeTracer: Usage ${currentUsageIndex} of ${this.currentUsages.length} for ${this.currentSymbol?.name}`,
                3000
            );
        } catch (error) {
            vscode.window.showErrorMessage(`CodeTracer: Error navigating to usage: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Show a list of all usages
     */
    private async showUsagesList(): Promise<void> {
        if (this.currentUsages.length === 0 || !this.currentSymbol) {
            return;
        }
        
        // Create a QuickPick list with all usages
        const items = this.currentUsages.map((usage, index) => {
            const fileName = usage.uri.path.split('/').pop() || '';
            return {
                label: `$(file-code) ${fileName}`,
                description: `Line ${usage.range.start.line + 1}`,
                detail: usage.context,
                usage,
                index
            };
        });
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `${this.currentUsages.length} usages of ${this.currentSymbol.name}`
        });
        
        if (selected) {
            this.currentIndex = selected.index;
            await this.navigateToUsage(selected.usage);
        }
    }
}
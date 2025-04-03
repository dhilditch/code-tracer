import * as vscode from 'vscode';
import { CodeScanner, Symbol, Usage } from '../scanner';

/**
 * Provider for hover information about code usages
 */
export class HoverProvider implements vscode.HoverProvider {
    private scanner: CodeScanner;
    
    constructor(scanner: CodeScanner) {
        this.scanner = scanner;
    }
    
    /**
     * Provide hover information for a symbol
     */
    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Get the symbol at the current position
        const symbol = await this.scanner.getSymbolAtPosition(document, position);
        
        if (!symbol) {
            return null;
        }
        
        // Get usages for this symbol
        const usages = await this.scanner.findUsages(symbol);
        
        // Generate hover content
        const hoverContent = await this.generateHoverContent(symbol, usages);
        
        return new vscode.Hover(hoverContent);
    }
    
    /**
     * Generate hover content for a symbol and its usages
     */
    private async generateHoverContent(symbol: Symbol, usages: Usage[]): Promise<vscode.MarkdownString[]> {
        const result: vscode.MarkdownString[] = [];
        
        // Create markdown content
        const content = new vscode.MarkdownString();
        content.isTrusted = true;
        content.supportHtml = true;
        
        // Add symbol information
        content.appendMarkdown(`### ${symbol.name}\n\n`);
        content.appendMarkdown(`**Type:** ${this.formatSymbolType(symbol.type)}\n\n`);
        
        if (symbol.container) {
            content.appendMarkdown(`**Container:** ${symbol.container}\n\n`);
        }
        
        // Add usage information
        if (usages.length > 0) {
            content.appendMarkdown(`**Used in ${usages.length} location${usages.length === 1 ? '' : 's'}:**\n\n`);
            
            // Group usages by file
            const usagesByFile = this.groupUsagesByFile(usages);
            
            for (const [file, fileUsages] of usagesByFile) {
                const fileName = this.getFileNameFromPath(file);
                content.appendMarkdown(`- **${fileName}** (${fileUsages.length} usage${fileUsages.length === 1 ? '' : 's'})\n`);
                
                // Show the first few usages with line numbers
                const maxUsagesToShow = 5;
                const usagesToShow = fileUsages.slice(0, maxUsagesToShow);
                
                for (const usage of usagesToShow) {
                    const lineNumber = usage.range.start.line + 1;
                    const usageType = this.formatUsageType(usage.type);
                    
                    content.appendMarkdown(`  - Line ${lineNumber}: ${usageType}\n`);
                    content.appendCodeblock(usage.context, this.getLanguageIdFromPath(file));
                }
                
                // If there are more usages, show a message
                if (fileUsages.length > maxUsagesToShow) {
                    content.appendMarkdown(`  - ... and ${fileUsages.length - maxUsagesToShow} more\n`);
                }
            }
            
            // Add a command to show all usages
            content.appendMarkdown('\n');
            content.appendMarkdown(`[Show all usages](command:codetracer.showUsages)\n\n`);
            
            // Add a command to navigate between usages
            content.appendMarkdown(`[Navigate between usages](command:codetracer.navigateToUsage)\n\n`);
        } else {
            content.appendMarkdown(`**No usages found**\n\n`);
        }
        
        result.push(content);
        
        return result;
    }
    
    /**
     * Group usages by file
     */
    private groupUsagesByFile(usages: Usage[]): Map<string, Usage[]> {
        const result = new Map<string, Usage[]>();
        
        for (const usage of usages) {
            const filePath = usage.uri.fsPath;
            
            if (!result.has(filePath)) {
                result.set(filePath, []);
            }
            
            result.get(filePath)?.push(usage);
        }
        
        return result;
    }
    
    /**
     * Format a symbol type for display
     */
    private formatSymbolType(type: Symbol['type']): string {
        switch (type) {
            case 'class':
                return 'Class';
            case 'function':
                return 'Function';
            case 'method':
                return 'Method';
            case 'selector':
                return 'CSS Selector';
            case 'variable':
                return 'CSS Variable';
            case 'event':
                return 'Event Handler';
            default:
                return type;
        }
    }
    
    /**
     * Format a usage type for display
     */
    private formatUsageType(type: Usage['type']): string {
        switch (type) {
            case 'call':
                return 'Call';
            case 'reference':
                return 'Reference';
            case 'extend':
                return 'Extension';
            case 'implement':
                return 'Implementation';
            case 'import':
                return 'Import';
            default:
                return type;
        }
    }
    
    /**
     * Get a file name from a file path
     */
    private getFileNameFromPath(path: string): string {
        return path.split(/[\/\\]/).pop() || path;
    }
    
    /**
     * Get the language ID from a file path
     */
    private getLanguageIdFromPath(path: string): string {
        const extension = path.split('.').pop()?.toLowerCase();
        
        switch (extension) {
            case 'php':
                return 'php';
            case 'js':
            case 'jsx':
            case 'ts':
            case 'tsx':
                return 'javascript';
            case 'css':
            case 'scss':
            case 'less':
                return 'css';
            default:
                return 'text';
        }
    }
}
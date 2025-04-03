import * as vscode from 'vscode';
import { Symbol, Usage } from './scanner';

export class CodeAnnotator {
    /**
     * Update annotations for all the provided symbols
     */
    async updateAnnotations(symbols: Symbol[]): Promise<void> {
        for (const symbol of symbols) {
            if (symbol.usages && symbol.usages.length > 0) {
                await this.updateSymbolAnnotation(symbol);
            }
        }
    }

    /**
     * Update or create annotations for a specific symbol
     */
    private async updateSymbolAnnotation(symbol: Symbol): Promise<void> {
        if (!symbol.usages || symbol.usages.length === 0) {
            return;
        }

        try {
            // Open the document that contains the symbol
            const document = await vscode.workspace.openTextDocument(symbol.uri);
            
            // Get the appropriate comment style for the file type
            const commentStyle = this.getCommentStyle(document.languageId);
            if (!commentStyle) {
                console.warn(`Unsupported file type for annotations: ${document.languageId}`);
                return;
            }
            
            // Find existing doc block or create a new one
            const existingBlock = this.findDocBlock(document, symbol.range.start.line, commentStyle);
            
            // Generate the annotation text
            const usageAnnotations = this.generateUsageAnnotations(symbol);
            
            // Apply the edit
            const edit = new vscode.WorkspaceEdit();
            
            if (existingBlock) {
                // Update existing doc block
                const updatedBlock = this.updateDocBlock(existingBlock.text, usageAnnotations, commentStyle);
                edit.replace(document.uri, existingBlock.range, updatedBlock);
            } else {
                // Create a new doc block
                const newBlock = this.createDocBlock(symbol.name, symbol.type, usageAnnotations, commentStyle);
                
                // Insert before the symbol definition
                const insertPosition = new vscode.Position(symbol.range.start.line, 0);
                edit.insert(document.uri, insertPosition, newBlock);
            }
            
            // Apply the edit to the workspace
            await vscode.workspace.applyEdit(edit);
        } catch (err) {
            console.error(`Error updating annotations for ${symbol.name}:`, err);
        }
    }
    
    /**
     * Find an existing doc block for a symbol
     */
    private findDocBlock(document: vscode.TextDocument, line: number, commentStyle: CommentStyle): { text: string, range: vscode.Range } | undefined {
        // Check if there is a doc block before the current line
        for (let i = line - 1; i >= 0; i--) {
            const lineText = document.lineAt(i).text.trim();
            
            // If we find a non-comment line before finding a doc block start, there's no doc block
            if (!lineText.startsWith(commentStyle.lineStart) && 
                !lineText.startsWith(commentStyle.blockStart) &&
                lineText !== '') {
                break;
            }
            
            // Found the start of a doc block
            if (lineText.startsWith(commentStyle.blockStart)) {
                // Find the end of the doc block
                let endLine = i;
                for (let j = i; j < line; j++) {
                    const blockLineText = document.lineAt(j).text.trim();
                    if (blockLineText.endsWith(commentStyle.blockEnd)) {
                        endLine = j;
                        break;
                    }
                }
                
                // Get the entire doc block
                const startPos = new vscode.Position(i, 0);
                const endPos = new vscode.Position(endLine, document.lineAt(endLine).text.length);
                const blockRange = new vscode.Range(startPos, endPos);
                const blockText = document.getText(blockRange);
                
                return { text: blockText, range: blockRange };
            }
        }
        
        return undefined;
    }
    
    /**
     * Update an existing doc block with @usedby annotations
     */
    private updateDocBlock(docBlock: string, usageAnnotations: string[], commentStyle: CommentStyle): string {
        const lines = docBlock.split('\n');
        const resultLines: string[] = [];
        let usedbyTagFound = false;
        
        // Remove existing @usedby annotations
        for (const line of lines) {
            if (line.trim().match(/@usedby\s/)) {
                usedbyTagFound = true;
                // Skip existing @usedby lines
                continue;
            }
            
            // If we find the end of the block and haven't added new @usedby tags yet
            if (line.trim().endsWith(commentStyle.blockEnd) && !usedbyTagFound) {
                // Add the new @usedby annotations before the closing tag
                for (const annotation of usageAnnotations) {
                    const indentation = line.match(/^\s*/)?.[0] || '';
                    resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
                }
                resultLines.push(line);
            } else {
                resultLines.push(line);
            }
        }
        
        // If we haven't added the @usedby tags yet (no end block found for some reason)
        if (!usedbyTagFound && !resultLines.some(line => line.trim().match(/@usedby\s/))) {
            const lastLine = resultLines.pop() || '';
            for (const annotation of usageAnnotations) {
                const indentation = lastLine.match(/^\s*/)?.[0] || '';
                resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
            }
            resultLines.push(lastLine);
        }
        
        return resultLines.join('\n');
    }
    
    /**
     * Create a new doc block with @usedby annotations
     */
    private createDocBlock(symbolName: string, symbolType: string, usageAnnotations: string[], commentStyle: CommentStyle): string {
        const lines: string[] = [];
        
        lines.push(commentStyle.blockStart);
        
        // Add a description based on the symbol type
        let description = '';
        switch (symbolType) {
            case 'class':
                description = `${symbolName} class`;
                break;
            case 'function':
                description = `${symbolName} function`;
                break;
            case 'method':
                description = `${symbolName} method`;
                break;
            case 'selector':
                description = `${symbolName} CSS selector`;
                break;
            default:
                description = symbolName;
        }
        
        lines.push(`${commentStyle.linePrefix} ${description}`);
        lines.push(`${commentStyle.linePrefix}`);
        
        // Add @usedby annotations
        for (const annotation of usageAnnotations) {
            lines.push(`${commentStyle.linePrefix} @usedby ${annotation}`);
        }
        
        lines.push(commentStyle.blockEnd);
        lines.push(''); // Add a blank line after the doc block
        
        return lines.join('\n');
    }
    
    /**
     * Generate @usedby annotations for a symbol
     */
    private generateUsageAnnotations(symbol: Symbol): string[] {
        if (!symbol.usages || symbol.usages.length === 0) {
            return [];
        }
        
        // Group usages by file path
        const usagesByFile = new Map<string, Usage[]>();
        
        for (const usage of symbol.usages) {
            const filePath = usage.uri.fsPath;
            if (!usagesByFile.has(filePath)) {
                usagesByFile.set(filePath, []);
            }
            usagesByFile.get(filePath)?.push(usage);
        }
        
        const annotations: string[] = [];
        
        // Create annotations for each file
        for (const [filePath, usages] of usagesByFile.entries()) {
            // Get relative path for better readability
            const workspaceFolders = vscode.workspace.workspaceFolders;
            let relativePath = filePath;
            
            if (workspaceFolders && workspaceFolders.length > 0) {
                const workspacePath = workspaceFolders[0].uri.fsPath;
                relativePath = filePath.replace(workspacePath, '').replace(/^[\/\\]/, '');
            }
            
            // Sort usages by line number
            usages.sort((a, b) => a.range.start.line - b.range.start.line);
            
            // Create annotation with line numbers
            const lineNumbers = usages.map(u => u.range.start.line + 1).join(', ');
            annotations.push(`${relativePath}:${lineNumbers} (${usages[0].type})`);
        }
        
        return annotations;
    }
    
    /**
     * Get the appropriate comment style for a file type
     */
    private getCommentStyle(languageId: string): CommentStyle | undefined {
        switch (languageId) {
            case 'php':
                return {
                    blockStart: '/**',
                    blockEnd: ' */',
                    lineStart: '//',
                    linePrefix: ' *'
                };
            case 'javascript':
            case 'typescript':
            case 'css':
            case 'scss':
            case 'less':
                return {
                    blockStart: '/**',
                    blockEnd: ' */',
                    lineStart: '//',
                    linePrefix: ' *'
                };
            default:
                return undefined;
        }
    }
}

interface CommentStyle {
    blockStart: string;
    blockEnd: string;
    lineStart: string;
    linePrefix: string;
}
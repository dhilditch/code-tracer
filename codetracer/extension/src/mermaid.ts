import * as vscode from 'vscode';
import { Symbol, Usage } from './scanner';

export class MermaidGenerator {
    /**
     * Generate Mermaid diagrams for each symbol in the results
     */
    async generateDiagrams(symbols: Symbol[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('codetracer');
        const diagramType = config.get('visualization.diagramType') as string;
        
        for (const symbol of symbols) {
            // Skip symbols with no usages
            if (!symbol.usages || symbol.usages.length === 0) {
                continue;
            }
            
            // Generate diagram content
            const diagram = this.generateDiagram(symbol, diagramType);
            
            // Update the symbol's documentation with the diagram
            await this.insertDiagramIntoDocumentation(symbol, diagram);
        }
    }
    
    /**
     * Generate a graph for a specific symbol
     */
    async generateGraphForWebview(symbol: Symbol): Promise<string> {
        const config = vscode.workspace.getConfiguration('codetracer');
        const diagramType = config.get('visualization.diagramType') as string;
        
        return this.generateDiagram(symbol, diagramType);
    }
    
    /**
     * Generate a Mermaid diagram for a symbol
     */
    private generateDiagram(symbol: Symbol, diagramType: string): string {
        if (!symbol.usages || symbol.usages.length === 0) {
            return '';
        }
        
        let diagram = '';
        
        switch (diagramType) {
            case 'flowchart':
                diagram = this.generateFlowchart(symbol);
                break;
            case 'graph':
            default:
                diagram = this.generateGraphDiagram(symbol);
                break;
        }
        
        return diagram;
    }
    
    /**
     * Generate a Mermaid flowchart diagram
     */
    private generateFlowchart(symbol: Symbol): string {
        if (!symbol.usages || symbol.usages.length === 0) {
            return '';
        }
        
        const lines: string[] = [];
        
        lines.push('```mermaid');
        lines.push('flowchart TD');
        
        // Create a node for the symbol
        const symbolId = this.sanitizeId(symbol.name);
        lines.push(`    ${symbolId}["${symbol.name} (${symbol.type})"]`);
        
        // Group usages by file
        const usagesByFile = new Map<string, Usage[]>();
        
        for (const usage of symbol.usages) {
            const fileName = this.getFileName(usage.uri.fsPath);
            if (!usagesByFile.has(fileName)) {
                usagesByFile.set(fileName, []);
            }
            usagesByFile.get(fileName)?.push(usage);
        }
        
        // Create nodes for each file with usages
        for (const [fileName, usages] of usagesByFile.entries()) {
            const fileId = this.sanitizeId(`file_${fileName}`);
            lines.push(`    ${fileId}["${fileName}"]`);
            
            // Connect the symbol to the file
            lines.push(`    ${symbolId} --> ${fileId}`);
            
            // Add label with line numbers
            const lineNumbers = usages.map(u => u.range.start.line + 1).join(', ');
            lines.push(`    ${symbolId} -- "Used at lines ${lineNumbers}" --> ${fileId}`);
        }
        
        lines.push('```');
        
        return lines.join('\n');
    }
    
    /**
     * Generate a Mermaid graph diagram
     */
    private generateGraphDiagram(symbol: Symbol): string {
        if (!symbol.usages || symbol.usages.length === 0) {
            return '';
        }
        
        const lines: string[] = [];
        
        lines.push('```mermaid');
        lines.push('graph LR');
        
        // Create a node for the symbol
        const symbolId = this.sanitizeId(symbol.name);
        lines.push(`    ${symbolId}["${symbol.name}"]`);
        
        // Create nodes for each usage and connect them
        const processedFiles = new Set<string>();
        
        for (const usage of symbol.usages) {
            const fileName = this.getFileName(usage.uri.fsPath);
            
            // Skip duplicate files
            if (processedFiles.has(fileName)) {
                continue;
            }
            
            processedFiles.add(fileName);
            
            const fileId = this.sanitizeId(`file_${fileName}`);
            lines.push(`    ${fileId}["${fileName}"]`);
            
            // Direction of arrow depends on the usage type
            if (usage.type === 'call' || usage.type === 'reference') {
                lines.push(`    ${fileId} --> ${symbolId}`);
            } else if (usage.type === 'extend' || usage.type === 'implement') {
                lines.push(`    ${symbolId} --> ${fileId}`);
            } else {
                lines.push(`    ${symbolId} --- ${fileId}`);
            }
        }
        
        lines.push('```');
        
        return lines.join('\n');
    }
    
    /**
     * Insert a Mermaid diagram into the symbol's documentation
     */
    private async insertDiagramIntoDocumentation(symbol: Symbol, diagram: string): Promise<void> {
        if (!diagram) {
            return;
        }
        
        try {
            // Open the document
            const document = await vscode.workspace.openTextDocument(symbol.uri);
            
            // Get the appropriate comment style for the file type
            const commentStyle = this.getCommentStyle(document.languageId);
            if (!commentStyle) {
                return;
            }
            
            // Find existing doc block
            const existingBlock = this.findDocBlock(document, symbol.range.start.line, commentStyle);
            
            // Apply the edit
            const edit = new vscode.WorkspaceEdit();
            
            if (existingBlock) {
                // Check if the doc block already contains a Mermaid diagram
                if (existingBlock.text.includes('```mermaid')) {
                    // Replace existing diagram
                    const updatedBlock = this.replaceMermaidDiagram(existingBlock.text, diagram);
                    edit.replace(document.uri, existingBlock.range, updatedBlock);
                } else {
                    // Insert new diagram at the end of the doc block
                    const updatedBlock = this.insertMermaidDiagram(existingBlock.text, diagram, commentStyle);
                    edit.replace(document.uri, existingBlock.range, updatedBlock);
                }
            }
            
            // Apply the edit
            await vscode.workspace.applyEdit(edit);
        } catch (err) {
            console.error(`Error inserting diagram for ${symbol.name}:`, err);
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
     * Replace an existing Mermaid diagram in a doc block
     */
    private replaceMermaidDiagram(docBlock: string, diagram: string): string {
        // Find the start and end of the existing diagram
        const lines = docBlock.split('\n');
        const startIndex = lines.findIndex(line => line.includes('```mermaid'));
        
        if (startIndex === -1) {
            // No existing diagram, just append the new one
            return this.appendDiagram(docBlock, diagram);
        }
        
        // Find the end of the diagram
        let endIndex = -1;
        for (let i = startIndex + 1; i < lines.length; i++) {
            if (lines[i].includes('```')) {
                endIndex = i;
                break;
            }
        }
        
        if (endIndex === -1) {
            // Couldn't find the end, just append
            return this.appendDiagram(docBlock, diagram);
        }
        
        // Replace the diagram
        const beforeDiagram = lines.slice(0, startIndex);
        const afterDiagram = lines.slice(endIndex + 1);
        const diagramLines = diagram.split('\n');
        
        return [...beforeDiagram, ...diagramLines, ...afterDiagram].join('\n');
    }
    
    /**
     * Insert a Mermaid diagram into a doc block
     */
    private insertMermaidDiagram(docBlock: string, diagram: string, commentStyle: CommentStyle): string {
        const lines = docBlock.split('\n');
        
        // Find the end of the doc block
        const blockEndIndex = lines.findIndex(line => line.trim().endsWith(commentStyle.blockEnd));
        
        if (blockEndIndex === -1) {
            // Can't find the end of the block, just append
            return this.appendDiagram(docBlock, diagram);
        }
        
        // Insert before the end of the block
        const beforeEnd = lines.slice(0, blockEndIndex);
        const endLine = lines[blockEndIndex];
        const afterEnd = lines.slice(blockEndIndex + 1);
        
        // Format the diagram to be part of the doc block
        const formattedDiagram = this.formatDiagramForDocBlock(diagram, commentStyle);
        
        return [...beforeEnd, formattedDiagram, endLine, ...afterEnd].join('\n');
    }
    
    /**
     * Append a diagram to a doc block
     */
    private appendDiagram(docBlock: string, diagram: string): string {
        // Simple append
        return `${docBlock}\n${diagram}`;
    }
    
    /**
     * Format a Mermaid diagram to be included in a doc block
     */
    private formatDiagramForDocBlock(diagram: string, commentStyle: CommentStyle): string {
        const lines = diagram.split('\n');
        
        // Add the prefix to each line
        const formattedLines = lines.map(line => {
            if (line.trim() === '') {
                return `${commentStyle.linePrefix}`;
            }
            return `${commentStyle.linePrefix} ${line}`;
        });
        
        return formattedLines.join('\n');
    }
    
    /**
     * Sanitize a string to be used as a Mermaid node ID
     */
    private sanitizeId(id: string): string {
        return id.replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    /**
     * Get the filename from a path
     */
    private getFileName(path: string): string {
        return path.split(/[\/\\]/).pop() || path;
    }
    
    /**
     * Get the appropriate comment style for a file type
     */
    private getCommentStyle(languageId: string): CommentStyle | undefined {
        switch (languageId) {
            case 'php':
                return {
                    blockStart: '/**',
                    blockEnd: '*/',
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
                    blockEnd: '*/',
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
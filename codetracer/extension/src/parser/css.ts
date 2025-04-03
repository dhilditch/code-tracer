import * as vscode from 'vscode';
import { Symbol, Usage } from '../scanner';

export class CssParser {
    /**
     * Parse CSS content to extract symbols (selectors, rules)
     */
    async parseSymbols(content: string, uri: vscode.Uri): Promise<Symbol[]> {
        const symbols: Symbol[] = [];
        
        // Extract selectors
        symbols.push(...this.extractSelectors(content, uri));
        
        // Extract CSS variables
        symbols.push(...this.extractCssVariables(content, uri));
        
        return symbols;
    }
    
    /**
     * Find usages of a symbol in CSS content
     */
    async findUsages(content: string, uri: vscode.Uri, symbol: Symbol): Promise<Usage[]> {
        const usages: Usage[] = [];
        
        if (symbol.type === 'selector') {
            usages.push(...this.findSelectorUsages(content, uri, symbol));
        } else if (symbol.type === 'variable') {
            usages.push(...this.findVariableUsages(content, uri, symbol));
        }
        
        return usages;
    }
    
    /**
     * Extract CSS selectors from content
     */
    private extractSelectors(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Regular expression to find CSS selectors
        // This captures the selector up to the opening brace
        // It handles classes, IDs, and other selector types
        const selectorPattern = /([.#]?[A-Za-z0-9_-]+(?:\s*[+>~]\s*[.#]?[A-Za-z0-9_-]+)*(?:\s*:[A-Za-z-]+(?:\([^)]*\))?)*)\s*{/g;
        
        let match;
        while ((match = selectorPattern.exec(content)) !== null) {
            const selector = match[1].trim();
            
            // Skip if empty or if it's an at-rule like @media
            if (!selector || selector.startsWith('@')) {
                continue;
            }
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[1].length);
            
            // For class selectors, get just the class name
            let name = selector;
            let type = 'selector';
            
            if (selector.startsWith('.')) {
                name = selector.substring(1);
                
                // If there are pseudoclasses or other parts, take just the class name
                const spaceIndex = name.indexOf(' ');
                if (spaceIndex !== -1) {
                    name = name.substring(0, spaceIndex);
                }
                
                const pseudoIndex = name.indexOf(':');
                if (pseudoIndex !== -1) {
                    name = name.substring(0, pseudoIndex);
                }
            } else if (selector.startsWith('#')) {
                name = selector.substring(1);
                
                // If there are pseudoclasses or other parts, take just the ID
                const spaceIndex = name.indexOf(' ');
                if (spaceIndex !== -1) {
                    name = name.substring(0, spaceIndex);
                }
                
                const pseudoIndex = name.indexOf(':');
                if (pseudoIndex !== -1) {
                    name = name.substring(0, pseudoIndex);
                }
            }
            
            symbols.push({
                name: name,
                type: 'selector',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                container: selector
            });
        }
        
        return symbols;
    }
    
    /**
     * Extract CSS variables from content
     */
    private extractCssVariables(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Regular expression to find CSS variables (custom properties)
        // Matches: --variable-name: value;
        const variablePattern = /(--[A-Za-z0-9_-]+)\s*:/g;
        
        let match;
        while ((match = variablePattern.exec(content)) !== null) {
            const variableName = match[1];
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + variableName.length);
            
            symbols.push({
                name: variableName,
                type: 'variable',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition)
            });
        }
        
        return symbols;
    }
    
    /**
     * Find usages of a CSS selector
     */
    private findSelectorUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        const symbolName = symbol.name;
        
        if (!symbolName) {
            return usages;
        }
        
        // For class selectors
        if (symbol.container?.startsWith('.')) {
            // Look for HTML class attribute references
            const classPattern = new RegExp(`class\\s*=\\s*["'][^"']*\\b${symbolName}\\b[^"']*["']`, 'g');
            
            let match;
            while ((match = classPattern.exec(content)) !== null) {
                // Get context (the line where the usage occurs)
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
                
                const startPosition = this.getPositionFromOffset(content, match.index);
                const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
                
                usages.push({
                    uri: uri,
                    range: new vscode.Range(startPosition, endPosition),
                    context: context,
                    type: 'reference'
                });
            }
            
            // Look for JavaScript classList references
            const classListPattern = new RegExp(`classList\\.(?:add|remove|toggle|contains)\\s*\\(\\s*["']${symbolName}["']\\s*\\)`, 'g');
            
            while ((match = classListPattern.exec(content)) !== null) {
                // Get context (the line where the usage occurs)
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
                
                const startPosition = this.getPositionFromOffset(content, match.index);
                const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
                
                usages.push({
                    uri: uri,
                    range: new vscode.Range(startPosition, endPosition),
                    context: context,
                    type: 'reference'
                });
            }
        } else if (symbol.container?.startsWith('#')) {
            // Look for HTML id attribute references
            const idPattern = new RegExp(`id\\s*=\\s*["']\\b${symbolName}\\b["']`, 'g');
            
            let match;
            while ((match = idPattern.exec(content)) !== null) {
                // Get context (the line where the usage occurs)
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
                
                const startPosition = this.getPositionFromOffset(content, match.index);
                const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
                
                usages.push({
                    uri: uri,
                    range: new vscode.Range(startPosition, endPosition),
                    context: context,
                    type: 'reference'
                });
            }
            
            // Look for getElementById references
            const getByIdPattern = new RegExp(`getElementById\\s*\\(\\s*["']${symbolName}["']\\s*\\)`, 'g');
            
            while ((match = getByIdPattern.exec(content)) !== null) {
                // Get context (the line where the usage occurs)
                const lineStart = content.lastIndexOf('\n', match.index) + 1;
                const lineEnd = content.indexOf('\n', match.index);
                const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
                
                const startPosition = this.getPositionFromOffset(content, match.index);
                const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
                
                usages.push({
                    uri: uri,
                    range: new vscode.Range(startPosition, endPosition),
                    context: context,
                    type: 'reference'
                });
            }
        }
        
        return usages;
    }
    
    /**
     * Find usages of a CSS variable
     */
    private findVariableUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        const variableName = symbol.name;
        
        if (!variableName) {
            return usages;
        }
        
        // Look for var(--variable-name) usages
        const varPattern = new RegExp(`var\\s*\\(\\s*${variableName}\\s*(?:,\\s*[^)]*)?\\s*\\)`, 'g');
        
        let match;
        while ((match = varPattern.exec(content)) !== null) {
            // Skip variable definitions
            if (content.substring(match.index - 20, match.index).includes(variableName + ':')) {
                continue;
            }
            
            // Get context (the line where the usage occurs)
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index);
            const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            usages.push({
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                context: context,
                type: 'reference'
            });
        }
        
        return usages;
    }
    
    /**
     * Get a Position from a character offset in text
     */
    private getPositionFromOffset(content: string, offset: number): vscode.Position {
        const beforeOffset = content.substring(0, offset);
        const lines = beforeOffset.split('\n');
        const lineNumber = lines.length - 1;
        const charNumber = lines[lineNumber].length;
        
        return new vscode.Position(lineNumber, charNumber);
    }
}
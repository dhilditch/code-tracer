import * as vscode from 'vscode';
import { Symbol, Usage } from '../scanner';

export class PhpParser {
    /**
     * Parse PHP content to extract symbols (classes, functions, methods)
     */
    async parseSymbols(content: string, uri: vscode.Uri): Promise<Symbol[]> {
        const symbols: Symbol[] = [];
        
        // Extract classes
        symbols.push(...this.extractClasses(content, uri));
        
        // Extract global functions
        symbols.push(...this.extractFunctions(content, uri));
        
        return symbols;
    }
    
    /**
     * Find usages of a symbol in PHP content
     */
    async findUsages(content: string, uri: vscode.Uri, symbol: Symbol): Promise<Usage[]> {
        const usages: Usage[] = [];
        
        switch (symbol.type) {
            case 'class':
                usages.push(...this.findClassUsages(content, uri, symbol));
                break;
            case 'function':
                usages.push(...this.findFunctionUsages(content, uri, symbol));
                break;
            case 'method':
                usages.push(...this.findMethodUsages(content, uri, symbol));
                break;
        }
        
        return usages;
    }
    
    /**
     * Extract classes from PHP content
     */
    private extractClasses(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Pattern for class definitions
        // Matches: class ClassName {
        const classPattern = /class\s+([A-Za-z0-9_]+)(?:\s+extends\s+([A-Za-z0-9_\\]+))?(?:\s+implements\s+([A-Za-z0-9_\\, ]+))?\s*{/g;
        
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            const className = match[1];
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: className,
                type: 'class',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                container: this.extractNamespace(content, match.index)
            });
            
            // Extract methods from this class
            symbols.push(...this.extractMethods(content, uri, className, match.index));
        }
        
        return symbols;
    }
    
    /**
     * Extract functions from PHP content
     */
    private extractFunctions(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Pattern for function definitions
        // Matches: function functionName(
        const functionPattern = /function\s+([A-Za-z0-9_]+)\s*\(/g;
        
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            // Skip functions inside classes (methods)
            if (this.isInsideClass(content, match.index)) {
                continue;
            }
            
            const functionName = match[1];
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: functionName,
                type: 'function',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                container: this.extractNamespace(content, match.index)
            });
        }
        
        return symbols;
    }
    
    /**
     * Extract methods from a class
     */
    private extractMethods(content: string, uri: vscode.Uri, className: string, classStartOffset: number): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Find the class body
        const classContent = this.extractClassBody(content, classStartOffset);
        if (!classContent) {
            return symbols;
        }
        
        // Pattern for method definitions
        // Matches: public/protected/private function methodName(
        const methodPattern = /(public|protected|private)?\s*function\s+([A-Za-z0-9_]+)\s*\(/g;
        
        let match;
        while ((match = methodPattern.exec(classContent.content)) !== null) {
            const methodName = match[2];
            const absoluteOffset = classContent.offset + match.index;
            const startPosition = this.getPositionFromOffset(content, absoluteOffset);
            const endPosition = this.getPositionFromOffset(content, absoluteOffset + match[0].length);
            
            symbols.push({
                name: methodName,
                type: 'method',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                container: className
            });
        }
        
        return symbols;
    }
    
    /**
     * Find usages of a class in PHP content
     */
    private findClassUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        
        // Pattern for class usage
        // This includes:
        // - new ClassName(
        // - extends ClassName
        // - implements ClassName
        // - ClassName::
        // - typehints: function foo(ClassName $param)
        // - use statements: use Namespace\ClassName;
        const className = symbol.name;
        const classPattern = new RegExp(`(?:new\\s+|extends\\s+|implements\\s+|instanceof\\s+|::\\s*|\\(\\s*|,\\s*|use\\s+[^;]*\\\\)${className}(?:[^A-Za-z0-9_]|$)`, 'g');
        
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            // Get context (the line where the usage occurs)
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index);
            const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
            
            // Determine usage type
            let usageType: 'call' | 'reference' | 'extend' | 'implement' | 'import' = 'reference';
            
            if (match[0].includes('new')) {
                usageType = 'call';
            } else if (match[0].includes('extends')) {
                usageType = 'extend';
            } else if (match[0].includes('implements')) {
                usageType = 'implement';
            } else if (match[0].includes('use')) {
                usageType = 'import';
            }
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            usages.push({
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                context: context,
                type: usageType
            });
        }
        
        return usages;
    }
    
    /**
     * Find usages of a function in PHP content
     */
    private findFunctionUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        
        // Pattern for function usage
        // Matches: functionName(
        const functionName = symbol.name;
        const functionPattern = new RegExp(`${functionName}\\s*\\(`, 'g');
        
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            // Skip function definitions
            if (content.substring(Math.max(0, match.index - 20), match.index).includes('function')) {
                continue;
            }
            
            // Get context (the line where the usage occurs)
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index);
            const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + functionName.length);
            
            usages.push({
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                context: context,
                type: 'call'
            });
        }
        
        return usages;
    }
    
    /**
     * Find usages of a method in PHP content
     */
    private findMethodUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        
        // Pattern for method usage
        // Matches:
        // - $var->methodName(
        // - ClassName::methodName(
        const methodName = symbol.name;
        const methodPattern = new RegExp(`(?:\\$[A-Za-z0-9_]+->|[A-Za-z0-9_\\\\]+::)${methodName}\\s*\\(`, 'g');
        
        let match;
        while ((match = methodPattern.exec(content)) !== null) {
            // Skip method definitions
            if (content.substring(Math.max(0, match.index - 20), match.index).includes('function')) {
                continue;
            }
            
            // Get context (the line where the usage occurs)
            const lineStart = content.lastIndexOf('\n', match.index) + 1;
            const lineEnd = content.indexOf('\n', match.index);
            const context = content.substring(lineStart, lineEnd !== -1 ? lineEnd : content.length).trim();
            
            // Find where the method name starts in the match
            const methodNameIndex = match[0].indexOf(methodName);
            const startPosition = this.getPositionFromOffset(content, match.index + methodNameIndex);
            const endPosition = this.getPositionFromOffset(content, match.index + methodNameIndex + methodName.length);
            
            usages.push({
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                context: context,
                type: 'call'
            });
        }
        
        return usages;
    }
    
    /**
     * Extract the namespace from PHP content
     */
    private extractNamespace(content: string, offset: number): string | undefined {
        // Look for namespace declaration before the given offset
        const namespacePattern = /namespace\s+([A-Za-z0-9_\\]+)\s*;/g;
        
        let namespace: string | undefined;
        let match;
        
        while ((match = namespacePattern.exec(content)) !== null) {
            if (match.index < offset) {
                namespace = match[1];
            } else {
                break;
            }
        }
        
        return namespace;
    }
    
    /**
     * Check if an offset is inside a class definition
     */
    private isInsideClass(content: string, offset: number): boolean {
        // Simplified approach: check if there's a 'class' keyword before the offset
        // and the matching closing brace hasn't been reached yet
        const beforeContent = content.substring(0, offset);
        const lastClassKeyword = beforeContent.lastIndexOf('class ');
        
        if (lastClassKeyword === -1) {
            return false;
        }
        
        // Find the opening brace for the class
        const openingBraceIndex = beforeContent.indexOf('{', lastClassKeyword);
        
        if (openingBraceIndex === -1 || openingBraceIndex > offset) {
            return false;
        }
        
        // Count braces to find the matching closing brace
        let braceLevel = 1;
        for (let i = openingBraceIndex + 1; i < content.length; i++) {
            if (content[i] === '{') {
                braceLevel++;
            } else if (content[i] === '}') {
                braceLevel--;
                if (braceLevel === 0) {
                    // Found the matching closing brace
                    return i >= offset; // If offset is before this, we're inside the class
                }
            }
        }
        
        return true; // If we got here, we're inside an unclosed class
    }
    
    /**
     * Extract the body of a class including its braces
     */
    private extractClassBody(content: string, classStartOffset: number): { content: string, offset: number } | null {
        // Find the opening brace for the class
        const openingBraceIndex = content.indexOf('{', classStartOffset);
        
        if (openingBraceIndex === -1) {
            return null;
        }
        
        // Count braces to find the matching closing brace
        let braceLevel = 1;
        let closingBraceIndex = -1;
        
        for (let i = openingBraceIndex + 1; i < content.length; i++) {
            if (content[i] === '{') {
                braceLevel++;
            } else if (content[i] === '}') {
                braceLevel--;
                if (braceLevel === 0) {
                    closingBraceIndex = i;
                    break;
                }
            }
        }
        
        if (closingBraceIndex === -1) {
            return null;
        }
        
        return {
            content: content.substring(openingBraceIndex + 1, closingBraceIndex),
            offset: openingBraceIndex + 1
        };
    }
    
    /**
     * Get a Position from a character offset in text
     */
    private getPositionFromOffset(content: string, offset: number): vscode.Position {
        // Count the number of newlines before the offset to get the line number
        const beforeOffset = content.substring(0, offset);
        const lines = beforeOffset.split('\n');
        const lineNumber = lines.length - 1;
        
        // The character is the length of the last line
        const charNumber = lines[lineNumber].length;
        
        return new vscode.Position(lineNumber, charNumber);
    }
}
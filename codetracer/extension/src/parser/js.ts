import * as vscode from 'vscode';
import { Symbol, Usage } from '../scanner';

export class JsParser {
    /**
     * Parse JavaScript content to extract symbols (classes, functions, event handlers)
     */
    async parseSymbols(content: string, uri: vscode.Uri): Promise<Symbol[]> {
        const symbols: Symbol[] = [];
        
        // Extract classes
        symbols.push(...this.extractClasses(content, uri));
        
        // Extract functions
        symbols.push(...this.extractFunctions(content, uri));
        
        // Extract event handlers
        symbols.push(...this.extractEventHandlers(content, uri));
        
        return symbols;
    }
    
    /**
     * Find usages of a symbol in JavaScript content
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
            case 'event':
                usages.push(...this.findEventUsages(content, uri, symbol));
                break;
        }
        
        return usages;
    }
    
    /**
     * Extract classes from JavaScript content
     */
    private extractClasses(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Pattern for class declarations (ES6)
        // Matches: class ClassName { or class ClassName extends ParentClass {
        const classPattern = /class\s+([A-Za-z0-9_$]+)(?:\s+extends\s+([A-Za-z0-9_$.]+))?\s*{/g;
        
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            const className = match[1];
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: className,
                type: 'class',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition)
            });
            
            // Extract methods from this class
            symbols.push(...this.extractMethods(content, uri, className, match.index));
        }
        
        // Pattern for class expressions in assignments
        // Matches: const/let/var ClassName = class {
        const classExprPattern = /(const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*class\s*{/g;
        
        while ((match = classExprPattern.exec(content)) !== null) {
            const className = match[2];
            const startPosition = this.getPositionFromOffset(content, match.index + match[1].length + 1); // +1 for the space
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: className,
                type: 'class',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition)
            });
        }
        
        return symbols;
    }
    
    /**
     * Extract functions from JavaScript content
     */
    private extractFunctions(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Pattern for function declarations
        // Matches: function functionName(
        const functionPattern = /function\s+([A-Za-z0-9_$]+)\s*\(/g;
        
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            // Skip if inside a class
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
                range: new vscode.Range(startPosition, endPosition)
            });
        }
        
        // Pattern for arrow functions in assignments
        // Matches: const/let/var funcName = (params) => {
        const arrowFunctionPattern = /(const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>/g;
        
        while ((match = arrowFunctionPattern.exec(content)) !== null) {
            const functionName = match[2];
            const startPosition = this.getPositionFromOffset(content, match.index + match[1].length + 1); // +1 for the space
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: functionName,
                type: 'function',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition)
            });
        }
        
        // Pattern for function expressions in assignments
        // Matches: const/let/var funcName = function(
        const funcExprPattern = /(const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*function\s*\(/g;
        
        while ((match = funcExprPattern.exec(content)) !== null) {
            const functionName = match[2];
            const startPosition = this.getPositionFromOffset(content, match.index + match[1].length + 1); // +1 for the space
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: functionName,
                type: 'function',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition)
            });
        }
        
        return symbols;
    }
    
    /**
     * Extract event handlers from JavaScript content
     */
    private extractEventHandlers(content: string, uri: vscode.Uri): Symbol[] {
        const symbols: Symbol[] = [];
        
        // Pattern for addEventListener
        // Matches: addEventListener('eventName', function|handler
        const addEventListenerPattern = /addEventListener\s*\(\s*(?:'|")([^'"]+)(?:'|")\s*,\s*([A-Za-z0-9_$]+|\(?function)/g;
        
        let match;
        while ((match = addEventListenerPattern.exec(content)) !== null) {
            const eventName = match[1];
            let handlerName = match[2];
            
            // Skip anonymous functions
            if (handlerName === 'function' || handlerName === '(' || handlerName === '(function') {
                continue;
            }
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: eventName,
                type: 'event',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                container: handlerName
            });
        }
        
        // Pattern for on* attributes in HTML event handlers (from JS strings)
        // Matches: onclick='functionName(' or onclick="functionName("
        const onEventPattern = /on([a-z]+)=['"]([A-Za-z0-9_$]+)\s*\(/g;
        
        while ((match = onEventPattern.exec(content)) !== null) {
            const eventName = match[1];
            const handlerName = match[2];
            
            const startPosition = this.getPositionFromOffset(content, match.index);
            const endPosition = this.getPositionFromOffset(content, match.index + match[0].length);
            
            symbols.push({
                name: eventName,
                type: 'event',
                uri: uri,
                range: new vscode.Range(startPosition, endPosition),
                container: handlerName
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
        const classBody = this.extractClassBody(content, classStartOffset);
        if (!classBody) {
            return symbols;
        }
        
        // Pattern for method definitions
        // This matches both old-style and new shorthand methods
        // method() {}, async method() {}, get method() {}, set method() {}, *method() {}
        const methodPattern = /(?:async\s+)?(?:get\s+|set\s+|\*\s*)?([A-Za-z0-9_$]+)\s*\([^)]*\)\s*{/g;
        
        let match;
        while ((match = methodPattern.exec(classBody.content)) !== null) {
            const methodName = match[1];
            
            // Skip constructor
            if (methodName === 'constructor') {
                continue;
            }
            
            const absoluteOffset = classBody.offset + match.index;
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
     * Find usages of a class in JavaScript content
     */
    private findClassUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        
        // Pattern for class usage
        // This includes:
        // - new ClassName(
        // - extends ClassName
        // - instanceof ClassName
        const className = symbol.name;
        const classPattern = new RegExp(`(?:new\\s+|extends\\s+|instanceof\\s+)${className}(?:[^A-Za-z0-9_$]|$)`, 'g');
        
        let match;
        while ((match = classPattern.exec(content)) !== null) {
            // Skip class definitions
            if (content.substring(Math.max(0, match.index - 10), match.index).includes('class ')) {
                continue;
            }
            
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
     * Find usages of a function in JavaScript content
     */
    private findFunctionUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        
        // Pattern for function usage
        // Matches: functionName(
        const functionName = symbol.name;
        const escapedName = functionName.replace(/\$/g, '\\$');
        const functionPattern = new RegExp(`${escapedName}\\s*\\(`, 'g');
        
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            // Skip function definitions
            if (this.isPartOfDefinition(content, match.index)) {
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
     * Find usages of an event in JavaScript content
     */
    private findEventUsages(content: string, uri: vscode.Uri, symbol: Symbol): Usage[] {
        const usages: Usage[] = [];
        
        // Pattern for event usage
        // Matches: 'eventName', "eventName", or dispatchEvent('eventName')
        const eventName = symbol.name;
        const eventPattern = new RegExp(`['"]${eventName}['"]|dispatchEvent\\s*\\(\\s*['"]${eventName}['"]`, 'g');
        
        let match;
        while ((match = eventPattern.exec(content)) !== null) {
            // Skip event handler definitions
            if (match.index > 15 && content.substring(match.index - 15, match.index).includes('addEventListener')) {
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
     * Check if an offset is part of a definition
     */
    private isPartOfDefinition(content: string, offset: number): boolean {
        // Check if this is a function definition
        const beforeContent = content.substring(Math.max(0, offset - 50), offset).trim();
        
        return (
            beforeContent.endsWith('function ') || 
            beforeContent.endsWith('function') ||
            beforeContent.includes(' = function') ||
            beforeContent.includes(' = (') ||
            beforeContent.includes(' => {')
        );
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
     * Extract the body of a class
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
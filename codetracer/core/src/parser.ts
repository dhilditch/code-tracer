/**
 * Core parser functionality shared between language parsers
 */
export interface Symbol {
    id: string;
    name: string;
    type: 'class' | 'function' | 'method' | 'selector' | 'variable' | 'event' | 'file';
    filePath: string;
    position: {
        line: number;
        character: number;
    };
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    container?: string;
    documentation?: string;
    usages?: Usage[];
}

export interface Usage {
    filePath: string;
    position: {
        line: number;
        character: number;
    };
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    context: string;
    type: 'call' | 'reference' | 'extend' | 'implement' | 'import' | 'inclusion';
}

export interface ParserOptions {
    scanDepth?: 'basic' | 'deep';
    includeInternalUsages?: boolean;
}

/**
 * Base language parser class
 */
export abstract class LanguageParser {
    protected options: ParserOptions;

    constructor(options: ParserOptions = {}) {
        this.options = {
            scanDepth: 'basic',
            includeInternalUsages: true,
            ...options
        };
    }

    /**
     * Parse content to extract symbols
     * @param content The content to parse
     * @param filePath The path to the file
     */
    abstract parseSymbols(content: string, filePath: string): Symbol[];

    /**
     * Find usages of a symbol in the content
     * @param content The content to search
     * @param filePath The path to the file
     * @param symbol The symbol to find usages of
     */
    abstract findUsages(content: string, filePath: string, symbol: Symbol): Usage[];

    /**
     * Generate a unique ID for a symbol
     */
    protected generateSymbolId(symbol: Partial<Symbol>): string {
        return `${symbol.filePath}#${symbol.name}#${symbol.position?.line}:${symbol.position?.character}`;
    }

    /**
     * Get position from a character offset in text
     */
    protected getPositionFromOffset(content: string, offset: number): { line: number; character: number } {
        const beforeOffset = content.substring(0, offset);
        const lines = beforeOffset.split('\n');
        
        return {
            line: lines.length - 1,
            character: lines[lines.length - 1].length
        };
    }

    /**
     * Extract context around a usage
     */
    protected extractContext(content: string, offset: number, length: number = 100): string {
        // Find the line start and end
        const lineStart = content.lastIndexOf('\n', offset) + 1;
        const lineEnd = content.indexOf('\n', offset);
        
        // Get the line content
        const lineContent = content.substring(
            lineStart, 
            lineEnd !== -1 ? lineEnd : content.length
        ).trim();
        
        return lineContent;
    }
}
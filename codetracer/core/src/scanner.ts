import { Symbol, Usage, LanguageParser } from './parser';
import * as path from 'path';

export interface ScanOptions {
    includePatterns: string[];
    excludePatterns: string[];
    scanDepth?: 'basic' | 'deep';
    maxFilesToScan?: number;
    cacheResults?: boolean;
}

export interface ScanResult {
    symbols: Symbol[];
    scanTime: number;
    filesScanned: number;
    symbolsFound: number;
    usagesFound: number;
}

/**
 * Core scanner functionality for finding code relationships
 */
export class Scanner {
    private parsers: Map<string, LanguageParser> = new Map();
    private symbolCache: Map<string, Symbol> = new Map();
    private usageCache: Map<string, Usage[]> = new Map();
    private fileTimestamps: Map<string, number> = new Map();
    
    /**
     * Register a parser for a file extension
     */
    registerParser(extension: string, parser: LanguageParser): void {
        this.parsers.set(extension.toLowerCase(), parser);
    }
    
    /**
     * Get the appropriate parser for a file
     */
    getParserForFile(filePath: string): LanguageParser | undefined {
        const ext = path.extname(filePath).toLowerCase();
        return this.parsers.get(ext);
    }
    
    /**
     * Scan a file for symbols and usages
     */
    async scanFile(filePath: string, content: string): Promise<Symbol[]> {
        const parser = this.getParserForFile(filePath);
        
        if (!parser) {
            return [];
        }
        
        // Clear existing symbols for this file
        this.clearFileData(filePath);
        
        // Parse symbols
        const symbols = parser.parseSymbols(content, filePath);
        
        // Add symbols to cache
        symbols.forEach(symbol => {
            this.symbolCache.set(symbol.id, symbol);
        });
        
        // Update file timestamp
        this.fileTimestamps.set(filePath, Date.now());
        
        return symbols;
    }
    
    /**
     * Find usages of a symbol in a file
     */
    async findUsagesInFile(symbol: Symbol, filePath: string, content: string): Promise<Usage[]> {
        const parser = this.getParserForFile(filePath);
        
        if (!parser) {
            return [];
        }
        
        return parser.findUsages(content, filePath, symbol);
    }
    
    /**
     * Process a batch of files
     */
    async processBatch(
        files: { path: string; content: string }[],
        options: ScanOptions
    ): Promise<ScanResult> {
        const startTime = Date.now();
        let symbolsFound = 0;
        let usagesFound = 0;
        
        // First pass: scan for symbols
        for (const file of files) {
            const symbols = await this.scanFile(file.path, file.content);
            symbolsFound += symbols.length;
        }
        
        // Second pass: find usages (if we're doing a deep scan)
        if (options.scanDepth === 'deep') {
            for (const symbol of this.symbolCache.values()) {
                const usages: Usage[] = [];
                
                for (const file of files) {
                    const fileUsages = await this.findUsagesInFile(symbol, file.path, file.content);
                    usages.push(...fileUsages);
                }
                
                if (usages.length > 0) {
                    this.usageCache.set(symbol.id, usages);
                    symbol.usages = usages;
                    usagesFound += usages.length;
                }
            }
        }
        
        return {
            symbols: Array.from(this.symbolCache.values()),
            scanTime: Date.now() - startTime,
            filesScanned: files.length,
            symbolsFound,
            usagesFound
        };
    }
    
    /**
     * Clear data for a specific file
     */
    private clearFileData(filePath: string): void {
        // Remove symbols in this file
        for (const [id, symbol] of this.symbolCache.entries()) {
            if (symbol.filePath === filePath) {
                this.symbolCache.delete(id);
                
                // Also remove any usages for this symbol
                this.usageCache.delete(id);
            }
        }
        
        // Remove usages in this file
        for (const [symbolId, usages] of this.usageCache.entries()) {
            const filteredUsages = usages.filter(usage => usage.filePath !== filePath);
            
            if (filteredUsages.length !== usages.length) {
                this.usageCache.set(symbolId, filteredUsages);
                
                // Update the symbol's usages
                const symbol = this.symbolCache.get(symbolId);
                if (symbol) {
                    symbol.usages = filteredUsages;
                }
            }
        }
    }
    
    /**
     * Check if a file needs to be rescanned
     */
    fileNeedsRescan(filePath: string, timestamp: number): boolean {
        if (!this.fileTimestamps.has(filePath)) {
            return true;
        }
        
        return timestamp > this.fileTimestamps.get(filePath)!;
    }
    
    /**
     * Get all symbols defined in a file
     */
    getSymbolsInFile(filePath: string): Symbol[] {
        const result: Symbol[] = [];
        
        for (const symbol of this.symbolCache.values()) {
            if (symbol.filePath === filePath) {
                result.push(symbol);
            }
        }
        
        return result;
    }
    
    /**
     * Get a symbol by ID
     */
    getSymbol(id: string): Symbol | undefined {
        return this.symbolCache.get(id);
    }
    
    /**
     * Find a symbol at a specific position in a file
     */
    findSymbolAtPosition(filePath: string, line: number, character: number): Symbol | undefined {
        for (const symbol of this.symbolCache.values()) {
            if (symbol.filePath === filePath && 
                line >= symbol.range.start.line && line <= symbol.range.end.line &&
                (line !== symbol.range.start.line || character >= symbol.range.start.character) &&
                (line !== symbol.range.end.line || character <= symbol.range.end.character)) {
                return symbol;
            }
        }
        
        return undefined;
    }
    
    /**
     * Clear all cached data
     */
    clearCache(): void {
        this.symbolCache.clear();
        this.usageCache.clear();
        this.fileTimestamps.clear();
    }
}
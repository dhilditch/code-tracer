import * as vscode from 'vscode';
import * as path from 'path';
import { PhpParser } from './parser/php';
import { JsParser } from './parser/js';
import { CssParser } from './parser/css';

export interface Symbol {
    name: string;
    type: 'class' | 'function' | 'method' | 'selector' | 'variable' | 'event';
    uri: vscode.Uri;
    range: vscode.Range;
    container?: string;
    documentation?: string;
    usages?: Usage[];
}

export interface Usage {
    uri: vscode.Uri;
    range: vscode.Range;
    context: string;
    type: 'call' | 'reference' | 'extend' | 'implement' | 'import';
}

export class CodeScanner {
    private symbols: Map<string, Symbol> = new Map();
    private usagesBySymbol: Map<string, Usage[]> = new Map();
    private parsers: Map<string, any> = new Map();
    private scanCache: Map<string, number> = new Map();
    
    constructor() {
        this.parsers.set('php', new PhpParser());
        this.parsers.set('javascript', new JsParser());
        this.parsers.set('css', new CssParser());
    }
    
    /**
     * Scan the entire workspace for symbols and their usages
     */
    async scanWorkspace(): Promise<Symbol[]> {
        const startTime = Date.now();
        this.symbols.clear();
        this.usagesBySymbol.clear();
        
        // Get file patterns from configuration
        const config = vscode.workspace.getConfiguration('codetracer');
        const fileTypes = config.get('annotations.fileTypes') as string[];
        const excludePatterns = config.get('annotations.exclude') as string[];
        
        // Build exclude pattern for glob
        const excludeGlob = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : null;
        
        // Find all files matching the patterns
        const fileGlob = `**/{${fileTypes.join(',')}}`;
        const files = await vscode.workspace.findFiles(fileGlob, excludeGlob);
        
        // First pass: collect all symbols
        for (const file of files) {
            await this.scanFileForSymbols(file);
        }
        
        // Second pass: find usages
        for (const file of files) {
            await this.scanFileForUsages(file);
        }
        
        // Update usages for each symbol
        for (const [symbolKey, usages] of this.usagesBySymbol.entries()) {
            const symbol = this.symbols.get(symbolKey);
            if (symbol) {
                symbol.usages = usages;
            }
        }
        
        console.log(`Workspace scan completed in ${Date.now() - startTime}ms. Found ${this.symbols.size} symbols.`);
        return Array.from(this.symbols.values());
    }
    
    /**
     * Scan a single file for symbols and their usages
     */
    async scanFile(uri: vscode.Uri): Promise<Symbol[]> {
        const file = uri.fsPath;
        const fileType = this.getFileType(file);
        
        if (!fileType || !this.parsers.has(fileType)) {
            return [];
        }
        
        // Clear existing symbols and usages for this file
        this.clearFileData(uri);
        
        // Scan for symbols
        await this.scanFileForSymbols(uri);
        
        // Scan for usages
        await this.scanFileForUsages(uri);
        
        // Return symbols from this file
        return this.getSymbolsInFile(uri);
    }
    
    /**
     * Get the symbol at the given position
     */
    async getSymbolAtPosition(document: vscode.TextDocument, position: vscode.Position): Promise<Symbol | undefined> {
        const fileType = this.getFileType(document.fileName);
        
        if (!fileType || !this.parsers.has(fileType)) {
            return undefined;
        }
        
        // Get word at position
        const wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return undefined;
        }
        
        const word = document.getText(wordRange);
        
        // Try to find the symbol in our cache
        for (const symbol of this.symbols.values()) {
            if (symbol.name === word && 
                symbol.uri.fsPath === document.uri.fsPath && 
                symbol.range.contains(position)) {
                return symbol;
            }
        }
        
        // If not found, try to parse it on-demand
        const parser = this.parsers.get(fileType);
        const textContent = document.getText();
        const symbols = await parser.parseSymbols(textContent, document.uri);
        
        for (const symbol of symbols) {
            if (symbol.name === word && symbol.range.contains(position)) {
                // Add to our cache
                const key = this.getSymbolKey(symbol);
                this.symbols.set(key, symbol);
                return symbol;
            }
        }
        
        return undefined;
    }
    
    /**
     * Find all usages of a symbol
     */
    async findUsages(symbol: Symbol): Promise<Usage[]> {
        const symbolKey = this.getSymbolKey(symbol);
        
        // Check if we already have usages for this symbol
        if (this.usagesBySymbol.has(symbolKey)) {
            return this.usagesBySymbol.get(symbolKey) || [];
        }
        
        // If not, scan for usages
        const config = vscode.workspace.getConfiguration('codetracer');
        const fileTypes = config.get('annotations.fileTypes') as string[];
        const excludePatterns = config.get('annotations.exclude') as string[];
        
        // Build exclude pattern for glob
        const excludeGlob = excludePatterns.length > 0 ? `{${excludePatterns.join(',')}}` : null;
        
        // Find all files matching the patterns
        const fileGlob = `**/{${fileTypes.join(',')}}`;
        const files = await vscode.workspace.findFiles(fileGlob, excludeGlob);
        
        const usages: Usage[] = [];
        
        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const fileType = this.getFileType(file.fsPath);
                
                if (!fileType || !this.parsers.has(fileType)) {
                    continue;
                }
                
                const parser = this.parsers.get(fileType);
                const fileUsages = await parser.findUsages(document.getText(), document.uri, symbol);
                usages.push(...fileUsages);
            } catch (err) {
                console.error(`Error finding usages in ${file.fsPath}:`, err);
            }
        }
        
        this.usagesBySymbol.set(symbolKey, usages);
        return usages;
    }
    
    /**
     * Get a unique key for a symbol
     */
    private getSymbolKey(symbol: Symbol): string {
        return `${symbol.uri.fsPath}#${symbol.name}#${symbol.range.start.line}:${symbol.range.start.character}`;
    }
    
    /**
     * Get the file type from a file path
     */
    private getFileType(filePath: string): string | undefined {
        const ext = path.extname(filePath).toLowerCase();
        
        switch (ext) {
            case '.php':
                return 'php';
            case '.js':
            case '.jsx':
            case '.ts':
            case '.tsx':
                return 'javascript';
            case '.css':
            case '.scss':
            case '.less':
                return 'css';
            default:
                return undefined;
        }
    }
    
    /**
     * Clear symbols and usages for a file
     */
    private clearFileData(uri: vscode.Uri): void {
        // Remove symbols in this file
        for (const [key, symbol] of this.symbols.entries()) {
            if (symbol.uri.fsPath === uri.fsPath) {
                this.symbols.delete(key);
                
                // Also remove any usages for this symbol
                this.usagesBySymbol.delete(key);
            }
        }
        
        // Remove usages in this file
        for (const [symbolKey, usages] of this.usagesBySymbol.entries()) {
            const filteredUsages = usages.filter(usage => usage.uri.fsPath !== uri.fsPath);
            
            if (filteredUsages.length !== usages.length) {
                this.usagesBySymbol.set(symbolKey, filteredUsages);
            }
        }
    }
    
    /**
     * Scan a file for symbols
     */
    private async scanFileForSymbols(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const fileType = this.getFileType(document.fileName);
            
            if (!fileType || !this.parsers.has(fileType)) {
                return;
            }
            
            const parser = this.parsers.get(fileType);
            const symbols = await parser.parseSymbols(document.getText(), document.uri);
            
            // Add symbols to our cache
            for (const symbol of symbols) {
                const key = this.getSymbolKey(symbol);
                this.symbols.set(key, symbol);
            }
            
            // Update cache timestamp
            this.scanCache.set(uri.fsPath, Date.now());
        } catch (err) {
            console.error(`Error scanning symbols in ${uri.fsPath}:`, err);
        }
    }
    
    /**
     * Scan a file for usages
     */
    private async scanFileForUsages(uri: vscode.Uri): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const fileType = this.getFileType(document.fileName);
            
            if (!fileType || !this.parsers.has(fileType)) {
                return;
            }
            
            const parser = this.parsers.get(fileType);
            
            // Scan for usages of each symbol
            for (const symbol of this.symbols.values()) {
                const usages = await parser.findUsages(document.getText(), document.uri, symbol);
                
                if (usages.length > 0) {
                    const symbolKey = this.getSymbolKey(symbol);
                    const existingUsages = this.usagesBySymbol.get(symbolKey) || [];
                    this.usagesBySymbol.set(symbolKey, [...existingUsages, ...usages]);
                }
            }
        } catch (err) {
            console.error(`Error scanning usages in ${uri.fsPath}:`, err);
        }
    }
    
    /**
     * Get all symbols defined in a file
     */
    private getSymbolsInFile(uri: vscode.Uri): Symbol[] {
        const result: Symbol[] = [];
        
        for (const symbol of this.symbols.values()) {
            if (symbol.uri.fsPath === uri.fsPath) {
                result.push(symbol);
            }
        }
        
        return result;
    }
}
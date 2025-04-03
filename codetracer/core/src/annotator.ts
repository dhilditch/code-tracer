import { Symbol, Usage } from './parser';
import * as path from 'path';

export interface AnnotationOptions {
    includeMermaid?: boolean;
    updateExisting?: boolean;
    mermaidDiagramType?: 'flowchart' | 'graph';
    groupUsagesByFile?: boolean;
}

export interface CommentStyle {
    blockStart: string;
    blockEnd: string;
    lineStart: string;
    linePrefix: string;
}

/**
 * Core annotator functionality for updating code comments with @usedby annotations
 */
export class Annotator {
    /**
     * Get the appropriate comment style for a file type
     */
    getCommentStyle(fileExtension: string): CommentStyle {
        switch (fileExtension.toLowerCase()) {
            case '.php':
                return {
                    blockStart: '/**',
                    blockEnd: ' */',
                    lineStart: '//',
                    linePrefix: ' *'
                };
            case '.js':
            case '.jsx':
            case '.ts':
            case '.tsx':
            case '.css':
            case '.scss':
            case '.less':
                return {
                    blockStart: '/**',
                    blockEnd: ' */',
                    lineStart: '//',
                    linePrefix: ' *'
                };
            case '.py':
                return {
                    blockStart: '"""',
                    blockEnd: '"""',
                    lineStart: '#',
                    linePrefix: '#'
                };
            case '.rb':
                return {
                    blockStart: '=begin',
                    blockEnd: '=end',
                    lineStart: '#',
                    linePrefix: '#'
                };
            default:
                return {
                    blockStart: '/**',
                    blockEnd: ' */',
                    lineStart: '//',
                    linePrefix: ' *'
                };
        }
    }
    
    /**
     * Generate the @usedby annotations for a symbol
     */
    generateUsageAnnotations(symbol: Symbol, options: AnnotationOptions = {}): string[] {
        if (!symbol.usages || symbol.usages.length === 0) {
            return [];
        }
        
        // Options
        const groupByFile = options.groupUsagesByFile !== false;
        
        // Results
        const annotations: string[] = [];
        
        if (groupByFile) {
            // Group usages by file path
            const usagesByFile = new Map<string, Usage[]>();
            
            for (const usage of symbol.usages) {
                const filePath = usage.filePath;
                if (!usagesByFile.has(filePath)) {
                    usagesByFile.set(filePath, []);
                }
                usagesByFile.get(filePath)?.push(usage);
            }
            
            // Create annotations for each file
            for (const [filePath, usages] of usagesByFile.entries()) {
                // Get relative path for better readability
                const relativePath = this.getRelativePath(filePath, symbol.filePath);
                
                // Sort usages by line number
                usages.sort((a, b) => a.position.line - b.position.line);
                
                // Create annotation with line numbers
                const lineNumbers = usages.map(u => u.position.line + 1).join(', ');
                annotations.push(`${relativePath}:${lineNumbers} (${usages[0].type})`);
            }
        } else {
            // Create annotations for each usage individually
            symbol.usages.forEach(usage => {
                const relativePath = this.getRelativePath(usage.filePath, symbol.filePath);
                annotations.push(`${relativePath}:${usage.position.line + 1} (${usage.type})`);
            });
        }
        
        return annotations;
    }
    
    /**
     * Create a new doc block with @usedby annotations
     */
    createDocBlock(
        symbol: Symbol, 
        usageAnnotations: string[], 
        commentStyle: CommentStyle,
        options: AnnotationOptions = {}
    ): string {
        const lines: string[] = [];
        
        lines.push(commentStyle.blockStart);
        
        // Add a description based on the symbol type
        let description = '';
        switch (symbol.type) {
            case 'class':
                description = `${symbol.name} class`;
                break;
            case 'function':
                description = `${symbol.name} function`;
                break;
            case 'method':
                description = `${symbol.name} method`;
                break;
            case 'selector':
                description = `${symbol.name} CSS selector`;
                break;
            case 'variable':
                description = `${symbol.name} CSS variable`;
                break;
            case 'event':
                description = `${symbol.name} event handler`;
                break;
            default:
                description = symbol.name;
        }
        
        lines.push(`${commentStyle.linePrefix} ${description}`);
        lines.push(`${commentStyle.linePrefix}`);
        
        // Add @usedby annotations
        for (const annotation of usageAnnotations) {
            lines.push(`${commentStyle.linePrefix} @usedby ${annotation}`);
        }
        
        // Add Mermaid diagram if requested
        if (options.includeMermaid && symbol.usages && symbol.usages.length > 0) {
            lines.push(`${commentStyle.linePrefix}`);
            lines.push(`${commentStyle.linePrefix} Usage diagram:`);
            lines.push(`${commentStyle.linePrefix} \`\`\`mermaid`);
            
            // Generate the diagram
            const diagramType = options.mermaidDiagramType || 'flowchart';
            if (diagramType === 'flowchart') {
                this.appendFlowchartDiagram(lines, symbol, commentStyle);
            } else {
                this.appendGraphDiagram(lines, symbol, commentStyle);
            }
            
            lines.push(`${commentStyle.linePrefix} \`\`\``);
        }
        
        lines.push(commentStyle.blockEnd);
        lines.push(''); // Add a blank line after the doc block
        
        return lines.join('\n');
    }
    
    /**
     * Update an existing doc block with @usedby annotations
     */
    updateDocBlock(
        existingDocBlock: string, 
        usageAnnotations: string[], 
        commentStyle: CommentStyle,
        options: AnnotationOptions = {}
    ): string {
        const lines = existingDocBlock.split('\n');
        const resultLines: string[] = [];
        let usedbyTagFound = false;
        let mermaidFound = false;
        
        // Process the doc block line by line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Skip existing @usedby annotations if we're updating
            if (options.updateExisting !== false && line.trim().match(/@usedby\s/)) {
                usedbyTagFound = true;
                continue;
            }
            
            // Skip existing Mermaid diagram if we're updating
            if (options.updateExisting !== false && 
                options.includeMermaid && 
                line.includes('```mermaid')) {
                mermaidFound = true;
                // Skip until the end of the Mermaid block
                while (i < lines.length && !lines[i].includes('```')) {
                    i++;
                }
                if (i < lines.length && lines[i].includes('```')) {
                    i++; // Skip the closing ``` as well
                }
                continue;
            }
            
            // If we find the end of the block and haven't added new @usedby tags yet
            if (line.trim().endsWith(commentStyle.blockEnd) && !usedbyTagFound) {
                // Add the new @usedby annotations before the closing tag
                for (const annotation of usageAnnotations) {
                    const indentation = line.match(/^\s*/)?.[0] || '';
                    resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
                }
                
                // Add Mermaid diagram if requested and not already present
                if (options.includeMermaid && !mermaidFound && usageAnnotations.length > 0) {
                    const indentation = line.match(/^\s*/)?.[0] || '';
                    resultLines.push(`${indentation}${commentStyle.linePrefix}`);
                    resultLines.push(`${indentation}${commentStyle.linePrefix} Usage diagram:`);
                    resultLines.push(`${indentation}${commentStyle.linePrefix} \`\`\`mermaid`);
                    
                    // We need a symbol to generate a diagram, but we only have annotations
                    // For now, we'll just add a placeholder
                    resultLines.push(`${indentation}${commentStyle.linePrefix} graph LR`);
                    resultLines.push(`${indentation}${commentStyle.linePrefix}     A[Symbol] --> B[Usage 1]`);
                    resultLines.push(`${indentation}${commentStyle.linePrefix}     A --> C[Usage 2]`);
                    
                    resultLines.push(`${indentation}${commentStyle.linePrefix} \`\`\``);
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
     * Append a flowchart diagram for a symbol to the given lines
     */
    private appendFlowchartDiagram(lines: string[], symbol: Symbol, commentStyle: CommentStyle): void {
        if (!symbol.usages || symbol.usages.length === 0) {
            return;
        }
        
        lines.push(`${commentStyle.linePrefix} flowchart TD`);
        
        // Create a node for the symbol
        const symbolId = this.sanitizeId(symbol.name);
        lines.push(`${commentStyle.linePrefix}     ${symbolId}["${symbol.name} (${symbol.type})"]`);
        
        // Group usages by file
        const usagesByFile = new Map<string, Usage[]>();
        
        for (const usage of symbol.usages) {
            const fileName = path.basename(usage.filePath);
            if (!usagesByFile.has(fileName)) {
                usagesByFile.set(fileName, []);
            }
            usagesByFile.get(fileName)?.push(usage);
        }
        
        // Create nodes for each file with usages
        for (const [fileName, usages] of usagesByFile.entries()) {
            const fileId = this.sanitizeId(`file_${fileName}`);
            lines.push(`${commentStyle.linePrefix}     ${fileId}["${fileName}"]`);
            
            // Connect the symbol to the file
            lines.push(`${commentStyle.linePrefix}     ${symbolId} --> ${fileId}`);
            
            // Add label with line numbers
            const lineNumbers = usages.map(u => u.position.line + 1).join(', ');
            lines.push(`${commentStyle.linePrefix}     ${symbolId} -- "Used at lines ${lineNumbers}" --> ${fileId}`);
        }
    }
    
    /**
     * Append a graph diagram for a symbol to the given lines
     */
    private appendGraphDiagram(lines: string[], symbol: Symbol, commentStyle: CommentStyle): void {
        if (!symbol.usages || symbol.usages.length === 0) {
            return;
        }
        
        lines.push(`${commentStyle.linePrefix} graph LR`);
        
        // Create a node for the symbol
        const symbolId = this.sanitizeId(symbol.name);
        lines.push(`${commentStyle.linePrefix}     ${symbolId}["${symbol.name}"]`);
        
        // Create nodes for each usage and connect them
        const processedFiles = new Set<string>();
        
        for (const usage of symbol.usages) {
            const fileName = path.basename(usage.filePath);
            
            // Skip duplicate files
            if (processedFiles.has(fileName)) {
                continue;
            }
            
            processedFiles.add(fileName);
            
            const fileId = this.sanitizeId(`file_${fileName}`);
            lines.push(`${commentStyle.linePrefix}     ${fileId}["${fileName}"]`);
            
            // Direction of arrow depends on the usage type
            if (usage.type === 'call' || usage.type === 'reference') {
                lines.push(`${commentStyle.linePrefix}     ${fileId} --> ${symbolId}`);
            } else if (usage.type === 'extend' || usage.type === 'implement') {
                lines.push(`${commentStyle.linePrefix}     ${symbolId} --> ${fileId}`);
            } else {
                lines.push(`${commentStyle.linePrefix}     ${symbolId} --- ${fileId}`);
            }
        }
    }
    
    /**
     * Sanitize a string to be used as a Mermaid node ID
     */
    private sanitizeId(id: string): string {
        return id.replace(/[^a-zA-Z0-9]/g, '_');
    }
    
    /**
     * Get a relative path from one file to another
     */
    private getRelativePath(filePath: string, referenceFilePath: string): string {
        const fileDir = path.dirname(filePath);
        const referenceDir = path.dirname(referenceFilePath);
        
        if (fileDir === referenceDir) {
            return path.basename(filePath);
        }
        
        const relativePath = path.relative(referenceDir, filePath);
        return relativePath;
    }
}
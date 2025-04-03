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
                
                // Skip self-references (usages in the same file)
                if (filePath === symbol.filePath) {
                    continue;
                }
                
                // Skip entry point files like *.php in the root (main plugin file)
                if (this.isEntryPointFile(filePath) || this.isEntryPointFile(symbol.filePath)) {
                    continue;
                }
                
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
            // Create annotations for each usage individually, skipping self-references
            symbol.usages.forEach(usage => {
                // Skip self-references and entry points
                if (usage.filePath === symbol.filePath ||
                    this.isEntryPointFile(usage.filePath) ||
                    this.isEntryPointFile(symbol.filePath)) {
                    return;
                }
                
                const relativePath = this.getRelativePath(usage.filePath, symbol.filePath);
                annotations.push(`${relativePath}:${usage.position.line + 1} (${usage.type})`);
            });
        }
        
        return annotations;
    }
    
    /**
     * Check if a file is an entry point (main plugin file)
     */
    private isEntryPointFile(filePath: string): boolean {
        // Check if it's a PHP file in the root directory (common for WordPress plugins)
        const fileName = path.basename(filePath);
        const dirName = path.basename(path.dirname(filePath));
        
        // Files named like the plugin directory are likely entry points
        // For example: super-speedy-compare.php in super-speedy-compare directory
        const parentDirName = path.basename(path.dirname(path.dirname(filePath)));
        const fileNameNoExt = fileName.replace(/\.php$/, '');
        const isNamedLikeDir = parentDirName.includes(fileNameNoExt) ||
                              dirName.includes(fileNameNoExt) ||
                              fileNameNoExt.includes(dirName);
        
        // If it's a PHP file directly in the plugin root folder or named like the directory
        return fileName.endsWith('.php') &&
              (dirName === parentDirName || isNamedLikeDir);
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
        // If no usages to add, just return the existing block
        if (!usageAnnotations || usageAnnotations.length === 0) {
            return existingDocBlock;
        }
        
        const lines = existingDocBlock.split('\n');
        const resultLines: string[] = [];
        
        // Track existing @usedby entries to prevent duplicates
        let existingUsedByEntries: string[] = [];
        let usedbyTagSection = false;
        let mermaidFound = false;
        let addedNewEntries = false;
        
        // Find all existing @usedby entries
        for (const line of lines) {
            const match = line.trim().match(/@usedby\s+(.*)/);
            if (match && match[1]) {
                existingUsedByEntries.push(match[1].trim());
            }
        }
        
        // Process the doc block line by line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Detect @usedby tag section
            if (trimmedLine.match(/@usedby\s/)) {
                usedbyTagSection = true;
                
                // Add this line, we'll handle duplicates
                resultLines.push(line);
                continue;
            }
            
            // End of @usedby section when we hit another @ tag or blank line after @usedby
            if (usedbyTagSection &&
                (trimmedLine.startsWith('@') ||
                (trimmedLine === '' && lines[i-1].trim().match(/@usedby\s/)))) {
                usedbyTagSection = false;
                
                // Add new entries if not already added
                if (!addedNewEntries) {
                    const indentation = line.match(/^\s*/)?.[0] || '';
                    
                    // Add each new annotation that doesn't already exist
                    for (const annotation of usageAnnotations) {
                        // More precise duplicate detection
                        if (!existingUsedByEntries.some(entry => {
                            // Extract the file path part from the entry
                            const entryPathMatch = entry.match(/^([^:]+):/);
                            const annotationPathMatch = annotation.match(/^([^:]+):/);
                            
                            if (entryPathMatch && annotationPathMatch) {
                                // Compare file paths only, ignoring line numbers
                                return entryPathMatch[1].trim() === annotationPathMatch[1].trim();
                            }
                            return entry.includes(annotation);
                        })) {
                            resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
                            addedNewEntries = true;
                        }
                    }
                }
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
            if (trimmedLine.endsWith(commentStyle.blockEnd) && !addedNewEntries) {
                // Add the new @usedby annotations before the closing tag
                const indentation = line.match(/^\s*/)?.[0] || '';
                
                // Add a blank line before the usedby section if there's content
                if (resultLines.length > 1 &&
                    !resultLines[resultLines.length-1].trim().match(/@/) &&
                    !resultLines[resultLines.length-1].trim().match(/^\s*$/)) {
                    resultLines.push(`${indentation}${commentStyle.linePrefix}`);
                }
                
                // Add each new annotation that doesn't already exist
                for (const annotation of usageAnnotations) {
                    // More precise duplicate detection
                    if (!existingUsedByEntries.some(entry => {
                        // Extract the file path part from the entry
                        const entryPathMatch = entry.match(/^([^:]+):/);
                        const annotationPathMatch = annotation.match(/^([^:]+):/);
                        
                        if (entryPathMatch && annotationPathMatch) {
                            // Compare file paths only, ignoring line numbers
                            return entryPathMatch[1].trim() === annotationPathMatch[1].trim();
                        }
                        return entry.includes(annotation);
                    })) {
                        resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
                        addedNewEntries = true;
                    }
                }
                
                // Add Mermaid diagram if requested and not already present
                if (options.includeMermaid && !mermaidFound && addedNewEntries) {
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
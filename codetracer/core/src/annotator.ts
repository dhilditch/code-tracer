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
     * 
     * This creates a fresh doc block with annotations when there isn't one already
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
     * 
     * This carefully merges new @usedby annotations with existing ones,
     * avoiding duplication and ensuring the comment structure stays clean
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
        
        // To avoid duplicate comment blocks, check if this is a @usedby-only block
        // If it is, we'll likely want to merge it with other blocks or skip it
        const isUsedByOnlyBlock = existingDocBlock.split('\n')
            .filter(line => line.trim() &&
                !line.trim().startsWith(commentStyle.blockStart) &&
                !line.trim().endsWith(commentStyle.blockEnd))
            .every(line => line.trim().startsWith('@usedby'));
        
        // If this is only @usedby entries, we'll consider these when merging
        // but don't need to preserve the exact block structure
        if (isUsedByOnlyBlock) {
            // Just extract the @usedby entries and let them be merged later
            const usedByEntries = this.extractUsedByEntries(existingDocBlock);
            usageAnnotations = [...usageAnnotations, ...usedByEntries];
            
            // When it's just a @usedby block, we can create a new clean one
            const lines: string[] = [];
            lines.push(commentStyle.blockStart);
            
            // Add each unique annotation
            const uniqueAnnotations = this.deduplicateAnnotations(usageAnnotations);
            for (const annotation of uniqueAnnotations) {
                lines.push(`${commentStyle.linePrefix} @usedby ${annotation}`);
            }
            
            lines.push(commentStyle.blockEnd);
            return lines.join('\n');
        }
        
        const lines = existingDocBlock.split('\n');
        const resultLines: string[] = [];
        
        // Track existing @usedby entries to prevent duplicates
        let existingUsedByEntries = this.extractUsedByEntries(existingDocBlock);
        let usedbyTagSection = false;
        let mermaidFound = false;
        let addedNewEntries = false;
        
        // Merge all annotations, removing duplicates
        const allAnnotations = this.deduplicateAnnotations([...usageAnnotations, ...existingUsedByEntries]);
        
        // Process the doc block line by line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Skip existing @usedby annotations - we'll add our consolidated list later
            if (trimmedLine.match(/@usedby\s/)) {
                usedbyTagSection = true;
                continue;
            }
            
            // End of @usedby section
            if (usedbyTagSection && 
                (trimmedLine.startsWith('@') || trimmedLine === '' || 
                 trimmedLine.endsWith(commentStyle.blockEnd))) {
                
                usedbyTagSection = false;
                
                // Add consolidated @usedby annotations
                if (!addedNewEntries) {
                    const indentation = line.match(/^\s*/)?.[0] || '';
                    
                    // Add all unique annotations
                    for (const annotation of allAnnotations) {
                        resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
                        addedNewEntries = true;
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
                
                // Add a blank line before the usedby section if there's content and no blank line already
                if (resultLines.length > 1 &&
                    !resultLines[resultLines.length-1].trim().match(/@/) &&
                    !resultLines[resultLines.length-1].trim().match(/^\s*$/)) {
                    resultLines.push(`${indentation}${commentStyle.linePrefix}`);
                }
                
                // Add all unique annotations
                for (const annotation of allAnnotations) {
                    resultLines.push(`${indentation}${commentStyle.linePrefix} @usedby ${annotation}`);
                    addedNewEntries = true;
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
     * Extract @usedby entries from a doc block
     */
    extractUsedByEntries(docBlock: string): string[] {
        const entries: string[] = [];
        const lines = docBlock.split('\n');
        
        for (const line of lines) {
            const match = line.trim().match(/@usedby\s+(.*)/);
            if (match && match[1]) {
                entries.push(match[1].trim());
            }
        }
        
        return entries;
    }
    
    /**
     * Remove duplicate annotations with the same file path
     */
    deduplicateAnnotations(annotations: string[]): string[] {
        const filePathMap = new Map<string, string[]>();
        
        // Group by file path
        for (const annotation of annotations) {
            const pathMatch = annotation.match(/^([^:]+):/);
            if (pathMatch) {
                const filePath = pathMatch[1].trim();
                if (!filePathMap.has(filePath)) {
                    filePathMap.set(filePath, [annotation]);
                } else if (!filePathMap.get(filePath)?.includes(annotation)) {
                    // Only add if this exact annotation isn't already there
                    filePathMap.get(filePath)?.push(annotation);
                }
            }
        }
        
        // Flatten the map back to an array
        const result: string[] = [];
        for (const annotationGroup of filePathMap.values()) {
            // For each file path, keep only the annotation with the most information
            if (annotationGroup.length === 1) {
                result.push(annotationGroup[0]);
            } else {
                // Find the annotation with the most line numbers
                let bestAnnotation = annotationGroup[0];
                let maxLineCount = this.countLineNumbers(bestAnnotation);
                
                for (let i = 1; i < annotationGroup.length; i++) {
                    const lineCount = this.countLineNumbers(annotationGroup[i]);
                    if (lineCount > maxLineCount) {
                        maxLineCount = lineCount;
                        bestAnnotation = annotationGroup[i];
                    }
                }
                
                result.push(bestAnnotation);
            }
        }
        
        return result;
    }
    
    /**
     * Creates or updates a documentation block for a symbol, handling multiple consecutive blocks properly
     * This is a newer, more robust method that properly handles the case of multiple consecutive doc blocks
     * @public
     */
    processDocBlocks(
        content: string,
        symbol: Symbol,
        usageAnnotations: string[],
        commentStyle: CommentStyle,
        options: AnnotationOptions = {}
    ): string {
        const lines = content.split('\n');
        const lineOffset = symbol.position.line;
        
        // Find all doc blocks before the symbol
        let docBlocks: { start: number, end: number, content: string }[] = [];
        
        // Search for doc blocks before the symbol
        for (let i = lineOffset - 1; i >= 0; i--) {
            const line = lines[i].trim();
            
            // If we find a non-empty, non-comment line, stop searching
            if (line !== '' &&
                !line.startsWith(commentStyle.lineStart) &&
                !line.startsWith(commentStyle.blockStart) &&
                !line.endsWith(commentStyle.blockEnd)) {
                break;
            }
            
            // Found start of a doc block
            if (line.startsWith(commentStyle.blockStart)) {
                const blockStart = i;
                
                // Find end of this block
                let blockEnd = -1;
                for (let j = i; j < lineOffset; j++) {
                    if (lines[j].trim().endsWith(commentStyle.blockEnd)) {
                        blockEnd = j;
                        break;
                    }
                }
                
                if (blockEnd !== -1) {
                    const blockContent = lines.slice(blockStart, blockEnd + 1).join('\n');
                    docBlocks.push({
                        start: blockStart,
                        end: blockEnd,
                        content: blockContent
                    });
                    
                    // Skip to before this block to look for more blocks
                    i = blockStart - 1;
                }
            }
        }
        
        // Reverse the blocks to get them in original order
        docBlocks.reverse();
        
        // If there are no existing blocks, create a new one
        if (docBlocks.length === 0) {
            const newBlock = this.createDocBlock(symbol, usageAnnotations, commentStyle, options);
            
            // Split content at insertion position
            const beforeInsert = lines.slice(0, lineOffset).join('\n');
            const afterInsert = lines.slice(lineOffset).join('\n');
            
            return beforeInsert +
                  (beforeInsert ? '\n' : '') +
                  newBlock +
                  afterInsert;
        }
        
        // If we have existing blocks, we need to merge them or update them
        
        // Collect all @usedby entries from all blocks
        let allUsedByEntries: string[] = [];
        for (const block of docBlocks) {
            const blockEntries = this.extractUsedByEntries(block.content);
            allUsedByEntries.push(...blockEntries);
        }
        
        // Extract the description from the first block if available
        let description = '';
        if (docBlocks.length > 0) {
            const firstBlockLines = docBlocks[0].content.split('\n');
            if (firstBlockLines.length > 1) {
                const firstLine = firstBlockLines[1].trim();
                if (firstLine && !firstLine.startsWith('@')) {
                    description = firstLine.replace(new RegExp(`^${commentStyle.linePrefix}\\s*`), '');
                }
            }
        }
        
        // Create a new consolidated block
        const newLines: string[] = [];
        newLines.push(commentStyle.blockStart);
        
        // Add description if we have one
        if (description) {
            newLines.push(`${commentStyle.linePrefix} ${description}`);
            newLines.push(`${commentStyle.linePrefix}`);
        } else {
            // Default description based on symbol type
            newLines.push(`${commentStyle.linePrefix} ${symbol.name} ${symbol.type}`);
            newLines.push(`${commentStyle.linePrefix}`);
        }
        
        // Combine and deduplicate annotations
        const combinedAnnotations = [...usageAnnotations, ...allUsedByEntries];
        const uniqueAnnotations = this.deduplicateAnnotations(combinedAnnotations);
        
        // Add all unique annotations
        for (const annotation of uniqueAnnotations) {
            newLines.push(`${commentStyle.linePrefix} @usedby ${annotation}`);
        }
        
        // Add Mermaid diagram if requested
        if (options.includeMermaid && symbol.usages && symbol.usages.length > 0) {
            newLines.push(`${commentStyle.linePrefix}`);
            newLines.push(`${commentStyle.linePrefix} Usage diagram:`);
            newLines.push(`${commentStyle.linePrefix} \`\`\`mermaid`);
            
            const diagramType = options.mermaidDiagramType || 'flowchart';
            if (diagramType === 'flowchart') {
                this.appendFlowchartDiagram(newLines, symbol, commentStyle);
            } else {
                this.appendGraphDiagram(newLines, symbol, commentStyle);
            }
            
            newLines.push(`${commentStyle.linePrefix} \`\`\``);
        }
        
        newLines.push(commentStyle.blockEnd);
        const consolidatedBlock = newLines.join('\n');
        
        // Replace all blocks with the consolidated one
        if (docBlocks.length > 0) {
            const firstBlockStart = docBlocks[0].start;
            const lastBlockEnd = docBlocks[docBlocks.length - 1].end;
            
            const beforeAllBlocks = lines.slice(0, firstBlockStart).join('\n');
            const afterAllBlocks = lines.slice(lastBlockEnd + 1).join('\n');
            
            return beforeAllBlocks +
                   (beforeAllBlocks ? '\n' : '') +
                   consolidatedBlock +
                   (afterAllBlocks ? '\n' : '') +
                   afterAllBlocks;
        }
        
        return content;
    }
    
    /**
     * Count the number of line numbers in an annotation
     */
    private countLineNumbers(annotation: string): number {
        const match = annotation.match(/^[^:]+:(.+)\s+\(/);
        if (match && match[1]) {
            return match[1].split(',').length;
        }
        return 0;
    }
    
    /**
     * Determine if two annotations are equivalent (they refer to the same file and location)
     */
    private areAnnotationsEquivalent(annotation1: string, annotation2: string): boolean {
        // Extract file path and line number info
        const regex = /^([^:]+):(\d+(?:,\s*\d+)*)/;
        const match1 = annotation1.match(regex);
        const match2 = annotation2.match(regex);
        
        if (!match1 || !match2) {
            return false;
        }
        
        // Compare file paths
        if (match1[1].trim() !== match2[1].trim()) {
            return false;
        }
        
        // Parse line numbers
        const lines1 = match1[2].split(',').map(s => parseInt(s.trim(), 10)).sort();
        const lines2 = match2[2].split(',').map(s => parseInt(s.trim(), 10)).sort();
        
        // If they have different number of lines, they're not equivalent
        if (lines1.length !== lines2.length) {
            return false;
        }
        
        // Compare each line number
        for (let i = 0; i < lines1.length; i++) {
            if (lines1[i] !== lines2[i]) {
                return false;
            }
        }
        
        return true;
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
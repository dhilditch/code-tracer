import { Symbol, Usage } from './parser';

/**
 * Represents a node in the relationship graph
 */
export interface GraphNode {
    id: string;
    label: string;
    type: Symbol['type'] | 'file';
    filePath?: string;
    symbolId?: string;
    data?: any;
}

/**
 * Represents an edge in the relationship graph
 */
export interface GraphEdge {
    source: string;
    target: string;
    label?: string;
    type: Usage['type'] | 'contains';
}

/**
 * Options for graph generation
 */
export interface GraphOptions {
    includeFiles?: boolean;
    includeIndirectRelationships?: boolean;
    maxNodes?: number;
    groupByFile?: boolean;
    direction?: 'LR' | 'TD' | 'RL' | 'BT';
    nodeSpacing?: number;
    edgeLabels?: boolean;
}

/**
 * Class for building and manipulating relationship graphs
 */
export class RelationshipGraph {
    private nodes: Map<string, GraphNode> = new Map();
    private edges: GraphEdge[] = [];
    
    /**
     * Build a relationship graph from symbols
     */
    buildGraph(symbols: Symbol[], options: GraphOptions = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
        this.nodes.clear();
        this.edges = [];
        
        // Default options
        const includeFiles = options.includeFiles !== false;
        const groupByFile = options.groupByFile !== false;
        const includeIndirectRelationships = options.includeIndirectRelationships === true;
        const maxNodes = options.maxNodes || 100;
        
        // First add all symbols as nodes
        for (const symbol of symbols) {
            this.addSymbolNode(symbol);
            
            // Stop if we've reached the maximum number of nodes
            if (this.nodes.size >= maxNodes) {
                break;
            }
        }
        
        // Process relationships
        const processedSymbols = new Set<string>();
        
        for (const symbol of symbols) {
            if (processedSymbols.has(symbol.id)) {
                continue;
            }
            
            this.processSymbolRelationships(symbol, includeFiles, groupByFile);
            processedSymbols.add(symbol.id);
            
            // Stop if we've reached the maximum number of nodes
            if (this.nodes.size >= maxNodes) {
                break;
            }
        }
        
        // Add indirect relationships if requested
        if (includeIndirectRelationships) {
            this.addIndirectRelationships();
        }
        
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges
        };
    }
    
    /**
     * Build a graph for a specific symbol
     */
    buildSymbolGraph(symbol: Symbol, options: GraphOptions = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
        this.nodes.clear();
        this.edges = [];
        
        // Default options
        const includeFiles = options.includeFiles !== false;
        const groupByFile = options.groupByFile !== false;
        
        // Add the symbol as the central node
        this.addSymbolNode(symbol);
        
        // Add its relationships
        this.processSymbolRelationships(symbol, includeFiles, groupByFile);
        
        return {
            nodes: Array.from(this.nodes.values()),
            edges: this.edges
        };
    }
    
    /**
     * Generate a Mermaid diagram from a graph
     */
    generateMermaidDiagram(
        graph: { nodes: GraphNode[]; edges: GraphEdge[] }, 
        options: GraphOptions = {}
    ): string {
        const direction = options.direction || 'TD';
        const edgeLabels = options.edgeLabels !== false;
        
        const lines: string[] = [];
        
        lines.push(`graph ${direction}`);
        
        // Add nodes
        for (const node of graph.nodes) {
            const shape = this.getNodeShape(node.type);
            lines.push(`    ${node.id}${shape}["${node.label}"]`);
        }
        
        // Add edges
        for (const edge of graph.edges) {
            let arrowType = '-->';
            
            switch (edge.type) {
                case 'extend':
                    arrowType = '-->|extends|';
                    break;
                case 'implement':
                    arrowType = '-->|implements|';
                    break;
                case 'contains':
                    arrowType = '-->|contains|';
                    break;
                case 'call':
                    arrowType = '-->|calls|';
                    break;
                case 'reference':
                    arrowType = '-->|uses|';
                    break;
                case 'import':
                    arrowType = '-->|imports|';
                    break;
            }
            
            if (!edgeLabels) {
                arrowType = '-->';
            }
            
            if (edge.label && edgeLabels) {
                lines.push(`    ${edge.source} ${arrowType.replace('|', `|${edge.label}|`)} ${edge.target}`);
            } else {
                lines.push(`    ${edge.source} ${arrowType} ${edge.target}`);
            }
        }
        
        return lines.join('\n');
    }
    
    /**
     * Add a symbol as a node in the graph
     */
    private addSymbolNode(symbol: Symbol): void {
        if (this.nodes.has(symbol.id)) {
            return;
        }
        
        this.nodes.set(symbol.id, {
            id: symbol.id,
            label: symbol.name,
            type: symbol.type,
            filePath: symbol.filePath,
            symbolId: symbol.id,
            data: symbol
        });
    }
    
    /**
     * Add a file as a node in the graph
     */
    private addFileNode(filePath: string): string {
        const fileId = `file_${filePath.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        if (!this.nodes.has(fileId)) {
            const fileName = filePath.split(/[\/\\]/).pop() || filePath;
            
            this.nodes.set(fileId, {
                id: fileId,
                label: fileName,
                type: 'file',
                filePath: filePath
            });
        }
        
        return fileId;
    }
    
    /**
     * Process relationships for a symbol
     */
    private processSymbolRelationships(symbol: Symbol, includeFiles: boolean, groupByFile: boolean): void {
        if (!symbol.usages || symbol.usages.length === 0) {
            return;
        }
        
        if (groupByFile) {
            // Group usages by file
            const usagesByFile = new Map<string, Usage[]>();
            
            for (const usage of symbol.usages) {
                const filePath = usage.filePath;
                if (!usagesByFile.has(filePath)) {
                    usagesByFile.set(filePath, []);
                }
                usagesByFile.get(filePath)?.push(usage);
            }
            
            // Process each file
            for (const [filePath, usages] of usagesByFile.entries()) {
                if (includeFiles) {
                    // Add the file as a node
                    const fileId = this.addFileNode(filePath);
                    
                    // Add relationship between symbol and file
                    this.edges.push({
                        source: symbol.id,
                        target: fileId,
                        type: 'reference',
                        label: `Used ${usages.length} times`
                    });
                }
            }
        } else {
            // Process each usage individually
            for (const usage of symbol.usages) {
                if (includeFiles) {
                    // Add the file as a node
                    const fileId = this.addFileNode(usage.filePath);
                    
                    // Add relationship between symbol and file
                    this.edges.push({
                        source: symbol.id,
                        target: fileId,
                        type: usage.type,
                        label: `Line ${usage.position.line + 1}`
                    });
                }
            }
        }
    }
    
    /**
     * Add indirect relationships between nodes
     */
    private addIndirectRelationships(): void {
        // This is a simple implementation that connects nodes that share a file
        const nodesByFile = new Map<string, Set<string>>();
        
        // Group nodes by file
        for (const node of this.nodes.values()) {
            if (node.filePath) {
                if (!nodesByFile.has(node.filePath)) {
                    nodesByFile.set(node.filePath, new Set());
                }
                nodesByFile.get(node.filePath)?.add(node.id);
            }
        }
        
        // Connect nodes that share a file
        for (const [_, nodeIds] of nodesByFile.entries()) {
            if (nodeIds.size <= 1) {
                continue;
            }
            
            const nodeArray = Array.from(nodeIds);
            
            for (let i = 0; i < nodeArray.length; i++) {
                for (let j = i + 1; j < nodeArray.length; j++) {
                    // Skip if there's already an edge between these nodes
                    if (this.edges.some(e => 
                        (e.source === nodeArray[i] && e.target === nodeArray[j]) ||
                        (e.source === nodeArray[j] && e.target === nodeArray[i])
                    )) {
                        continue;
                    }
                    
                    this.edges.push({
                        source: nodeArray[i],
                        target: nodeArray[j],
                        type: 'reference',
                        label: 'Related'
                    });
                }
            }
        }
    }
    
    /**
     * Get the shape for a node based on its type
     */
    private getNodeShape(type: GraphNode['type']): string {
        switch (type) {
            case 'class':
                return '[';
            case 'function':
            case 'method':
                return '([';
            case 'selector':
            case 'variable':
                return '{';
            case 'event':
                return '((';
            case 'file':
                return '>';
            default:
                return '[';
        }
    }
}
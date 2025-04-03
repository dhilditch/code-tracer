import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Provider for webview-based code relationship visualizations
 */
export class WebviewProvider {
    private extensionUri: vscode.Uri;
    private currentPanel: vscode.WebviewPanel | undefined;
    
    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
    }
    
    /**
     * Show a Mermaid graph in a webview
     */
    async showGraph(graphData: string, symbolName: string): Promise<void> {
        const title = `CodeTracer: ${symbolName} Usage Graph`;
        
        // Create or reveal panel
        if (this.currentPanel) {
            this.currentPanel.reveal(vscode.ViewColumn.Beside);
            this.currentPanel.title = title;
        } else {
            this.currentPanel = vscode.window.createWebviewPanel(
                'codeTracerGraph',
                title,
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.extensionUri, 'media')
                    ]
                }
            );
            
            // Reset the panel reference when the panel is closed
            this.currentPanel.onDidDispose(() => {
                this.currentPanel = undefined;
            });
        }
        
        // Set the HTML content
        this.currentPanel.webview.html = this.getWebviewContent(graphData, symbolName);
    }
    
    /**
     * Generate the HTML content for the webview
     */
    private getWebviewContent(graphData: string, symbolName: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeTracer: ${symbolName} Usage Graph</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
        }
        .header {
            margin-bottom: 20px;
        }
        .graph-container {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 20px;
            border-radius: 4px;
        }
        h1 {
            font-size: 1.5em;
            font-weight: normal;
            color: var(--vscode-editor-foreground);
        }
        .controls {
            margin-top: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            border-radius: 2px;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .zoom-controls {
            display: flex;
            gap: 5px;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid@9.1.7/dist/mermaid.min.js"></script>
</head>
<body>
    <div class="header">
        <h1>Usage Graph for ${symbolName}</h1>
    </div>
    
    <div class="graph-container">
        <div class="mermaid">
${graphData}
        </div>
    </div>
    
    <div class="controls">
        <div class="zoom-controls">
            <button id="zoom-in">Zoom In</button>
            <button id="zoom-out">Zoom Out</button>
            <button id="reset-zoom">Reset Zoom</button>
        </div>
        <button id="save-image">Save as Image</button>
    </div>
    
    <script>
        // Initialize Mermaid
        mermaid.initialize({
            startOnLoad: true,
            theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default',
            securityLevel: 'loose',
            flowchart: {
                useMaxWidth: false,
                htmlLabels: true,
                curve: 'basis'
            }
        });
        
        // Zoom functionality
        const graphContainer = document.querySelector('.graph-container');
        let scale = 1.0;
        
        document.getElementById('zoom-in').addEventListener('click', () => {
            scale += 0.1;
            graphContainer.style.transform = \`scale(\${scale})\`;
            graphContainer.style.transformOrigin = 'top left';
        });
        
        document.getElementById('zoom-out').addEventListener('click', () => {
            scale = Math.max(0.1, scale - 0.1);
            graphContainer.style.transform = \`scale(\${scale})\`;
            graphContainer.style.transformOrigin = 'top left';
        });
        
        document.getElementById('reset-zoom').addEventListener('click', () => {
            scale = 1.0;
            graphContainer.style.transform = 'scale(1)';
        });
        
        // Save as image functionality
        document.getElementById('save-image').addEventListener('click', () => {
            // Send message to extension to save the SVG
            const svg = document.querySelector('.mermaid svg');
            if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                
                // Post message to VS Code extension
                vscode.postMessage({
                    command: 'saveImage',
                    data: svgData
                });
            }
        });
        
        // Add handler for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'refresh':
                    // Refresh the graph
                    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                    break;
            }
        });
        
        // Handle vscode theme changes
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    mermaid.initialize({
                        theme: document.body.classList.contains('vscode-dark') ? 'dark' : 'default'
                    });
                    mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                }
            }
        });
        
        observer.observe(document.body, { attributes: true });
        
        // Declare vscode API for messaging
        const vscode = acquireVsCodeApi();
    </script>
</body>
</html>`;
    }
}
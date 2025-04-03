# CodeTracer

A VS Code extension and CLI tool that implements the @usedby code documentation standard to track and visualize code relationships.

## Features

- **Automatic @usedby Annotations**: Automatically inserts and updates @usedby annotations in your code documentation comments
- **Code Relationship Visualization**: Generates Mermaid diagrams showing code relationships
- **Multi-language Support**: Works with PHP, JavaScript/TypeScript, and CSS
- **VS Code Integration**: Provides hover information, quick navigation, and visualization tools inside VS Code
- **Command Line Interface**: Scan, annotate, and visualize your codebase from the command line

## Project Structure

```
codetracer/
├── extension/              # VS Code extension
│   ├── src/
│   │   ├── extension.ts    # Extension entry point
│   │   ├── scanner.ts      # Code scanning functionality
│   │   ├── annotator.ts    # Comment block management
│   │   ├── mermaid.ts      # Mermaid diagram generation
│   │   ├── parser/         # Language-specific parsers
│   │   └── providers/      # VS Code UI providers
│   ├── package.json        # Extension manifest
│   └── tsconfig.json       # TypeScript configuration
│
├── cli/                    # Command line tool
│   ├── src/
│   │   ├── index.ts        # CLI entry point
│   │   ├── parsers.ts      # Language parser implementations
│   │   └── commands/       # CLI commands
│   ├── package.json        # CLI package config
│   └── tsconfig.json       # TypeScript configuration
│
└── core/                   # Shared functionality
    ├── src/
    │   ├── parser.ts       # Core parsing logic
    │   ├── scanner.ts      # Usage detection
    │   ├── annotator.ts    # Comment manipulation
    │   └── graph.ts        # Relationship graph building
    └── package.json        # Core package config
```

## VS Code Extension Usage

### Commands

- `CodeTracer: Scan Workspace for Code Relationships` - Scan the entire workspace for code relationships
- `CodeTracer: Scan Current File` - Scan only the current file
- `CodeTracer: Toggle Mermaid Diagram Generation` - Enable or disable Mermaid diagram generation
- `CodeTracer: Show Usages of Selected Symbol` - Show all usages of the currently selected symbol
- `CodeTracer: Navigate Between Usages` - Navigate to next/previous usage

### Settings

- `codetracer.annotations.updateOnSave`: Enable/disable automatic updates on save
- `codetracer.annotations.fileTypes`: Configure file types to scan
- `codetracer.annotations.exclude`: Set patterns to exclude
- `codetracer.visualization.embedMermaid`: Control Mermaid diagram generation
- `codetracer.visualization.diagramType`: Choose diagram type (flowchart or graph)

## Installation

### VS Code Extension

There are several ways to install the VS Code extension:

#### From VSIX File (Recommended for this project)

1. Package the extension into a VSIX file:
   ```bash
   # From the root directory
   npm run package:ext
   # Or from the extension directory
   cd extension
   npm run vsce package
   ```

2. Install the extension in VS Code:
   - Open VS Code
   - Go to Extensions view (Ctrl+Shift+X)
   - Click on the "..." menu in the top-right of the Extensions view
   - Select "Install from VSIX..."
   - Navigate to and select the generated VSIX file in the extension directory

#### From Source (For Development)

1. Clone the repository
2. Build the extension:
   ```bash
   # From the root directory
   npm install
   npm run build
   ```
3. Create a symbolic link to the extension in your VS Code extensions folder:
   ```bash
   # On Windows (PowerShell with Admin privileges)
   New-Item -ItemType SymbolicLink -Path "$env:USERPROFILE\.vscode\extensions\codetracer" -Target "<path-to-repo>\extension"
   
   # On macOS/Linux
   ln -s /path/to/repo/extension ~/.vscode/extensions/codetracer
   ```
4. Restart VS Code

### CLI Tool

#### Local Installation (From Source)

```bash
# From the root directory
npm install
npm run build
cd cli
npm link
```

This makes the `codetracer` command available globally on your system.

## CLI Usage

### Commands

#### Scan

```bash
codetracer scan [path] --output results.json
```

Options:
- `--output, -o`: Output file for scan results
- `--exclude, -e`: File patterns to exclude
- `--include, -i`: File patterns to include
- `--depth, -d`: Scan depth (basic or deep)

#### Annotate

```bash
codetracer annotate [path] --input results.json --mermaid
```

Options:
- `--input, -i`: Input file with scan results
- `--mermaid`: Include Mermaid diagrams in annotations
- `--diagram-type`: Type of diagram (flowchart or graph)

#### Visualize

```bash
codetracer visualize --input results.json --output graph.md --format mermaid
```

Options:
- `--input, -i`: Input file with scan results
- `--output, -o`: Output file for visualization
- `--format, -f`: Output format (mermaid, svg, json)
- `--direction, -d`: Graph direction (LR, TD, RL, BT)
- `--symbol, -s`: Focus on a specific symbol

## Development

### Project Setup

The CodeTracer project uses a monorepo structure with three main packages:
- `core` - Shared functionality used by both the extension and CLI
- `extension` - VS Code extension
- `cli` - Command line interface

To set up the entire project for development:

```bash
# Clone the repository
git clone https://github.com/yourusername/codetracer.git
cd codetracer

# Install dependencies for all packages
npm install

# Build all packages
npm run build
```

### Building Individual Components

You can also build and test individual components:

#### Core Library

```bash
cd core
npm install
npm run build
```

#### VS Code Extension

```bash
cd extension
npm install
npm run build
# For development with automatic rebuilding:
npm run watch
```

#### CLI Tool

```bash
cd cli
npm install
npm run build
# Link the CLI tool globally for testing:
npm link
```

After linking, you can use the `codetracer` command globally. The CLI name is determined by the `bin` field in the `cli/package.json` file.

### Testing

```bash
# Run all tests
npm test

# Test individual components
npm run test:core
npm run test:cli
npm run test:ext
```

### Packaging for Distribution

#### VS Code Extension

```bash
cd extension
npm run vsce package
```
This creates a .vsix file in the extension directory that can be installed manually in VS Code.

#### CLI Tool

```bash
cd cli
npm pack
```
This creates a tarball that can be installed via npm.

## License

MIT
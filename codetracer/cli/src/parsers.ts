import { LanguageParser, Symbol, Usage } from 'codetracer-core';
import * as path from 'path';
import * as fs from 'fs';

// This file creates and configures parsers for different file types
class PhpParserImpl extends LanguageParser {
  // Keywords that should not be treated as functions
  private reservedKeywords = [
    'require', 'require_once', 'include', 'include_once', 'echo', 'print', 'return',
    'if', 'for', 'foreach', 'while', 'switch', 'case', 'break', 'continue', 'default'
  ];

  parseSymbols(content: string, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];
    const fileName = path.basename(filePath);
    
    // Check for file requirements (require_once, include, etc.)
    this.findRequirements(content, filePath, symbols);
    
    // Find PHP classes
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g;
    let classMatch;
    
    while ((classMatch = classRegex.exec(content)) !== null) {
      const className = classMatch[1];
      const classPosition = this.getPositionFromOffset(content, classMatch.index);
      const classEndIndex = content.indexOf('{', classMatch.index + classMatch[0].length);
      const classEndPosition = this.getPositionFromOffset(content, classEndIndex);
      
      const classSymbol: Symbol = {
        id: this.generateSymbolId({
          name: className,
          filePath,
          position: classPosition
        }),
        name: className,
        type: 'class',
        filePath,
        position: classPosition,
        range: {
          start: classPosition,
          end: classEndPosition
        },
        documentation: this.extractPhpDocBlock(content, classMatch.index),
        usages: []
      };
      
      symbols.push(classSymbol);
    }
    
    // Find PHP functions
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)/g;
    let functionMatch;
    
    while ((functionMatch = functionRegex.exec(content)) !== null) {
      // Skip functions inside classes (methods) - simple heuristic
      const beforeFunction = content.substring(0, functionMatch.index);
      const lastOpenBrace = beforeFunction.lastIndexOf('{');
      const lastCloseBrace = beforeFunction.lastIndexOf('}');
      
      // Only process if function is not inside a class
      if (lastOpenBrace === -1 || lastCloseBrace > lastOpenBrace) {
        const functionName = functionMatch[1];
        const functionPosition = this.getPositionFromOffset(content, functionMatch.index);
        const functionBodyStart = content.indexOf('{', functionMatch.index + functionMatch[0].length);
        const functionBodyStartPosition = this.getPositionFromOffset(content, functionBodyStart);
        
        const functionSymbol: Symbol = {
          id: this.generateSymbolId({
            name: functionName,
            filePath,
            position: functionPosition
          }),
          name: functionName,
          type: 'function',
          filePath,
          position: functionPosition,
          range: {
            start: functionPosition,
            end: functionBodyStartPosition
          },
          documentation: this.extractPhpDocBlock(content, functionMatch.index),
          usages: []
        };
        
        symbols.push(functionSymbol);
      }
    }
    
    return symbols;
  }
  /**
   * Find file requirements (require_once, include, etc.) and create annotations
   * This method creates symbols representing inclusion relationships
   */
  private findRequirements(content: string, filePath: string, symbols: Symbol[]): void {
    // Regex to match require/include statements
    const requireRegex = /(require|require_once|include|include_once)\s*\(\s*(?:['"])([^'"]+)(?:['"])\s*\)/g;
    let requireMatch;
    
    while ((requireMatch = requireRegex.exec(content)) !== null) {
      const requireType = requireMatch[1]; // require, require_once, etc.
      const requiredFile = requireMatch[2]; // The file path
      const position = this.getPositionFromOffset(content, requireMatch.index);
      
      // Try to resolve the file path relative to the current file
      const dirName = path.dirname(filePath);
      let resolvedPath = '';
      
      if (requiredFile.startsWith('./') || requiredFile.startsWith('../')) {
        // Relative path
        resolvedPath = path.resolve(dirName, requiredFile);
      } else if (requiredFile.startsWith('/')) {
        // Absolute path
        resolvedPath = requiredFile;
      } else {
        // Assume it's relative to current file
        resolvedPath = path.resolve(dirName, requiredFile);
      }
      
      // Check if the file exists
      if (fs.existsSync(resolvedPath)) {
        // ---- IMPORTANT FIXES ----
        
        // Fix 1: Skip if this would be a self-reference (file including itself)
        if (path.normalize(resolvedPath) === path.normalize(filePath)) {
          continue;
        }
        
        // Fix 2: Convert file paths to relative format to avoid adding same paths with different formats
        const relativeFilePath = path.relative(process.cwd(), filePath);
        const relativeResolvedPath = path.relative(process.cwd(), resolvedPath);
        
        const currentFileName = path.basename(filePath);
        const includedFileName = path.basename(resolvedPath);
        
        // Fix 3: Check if the paths might be referring to the same file with different paths
        // This handles the case of files within the same directory but with different paths
        const fileNameNoExt = path.basename(filePath, path.extname(filePath));
        const resolvedNameNoExt = path.basename(resolvedPath, path.extname(resolvedPath));
        
        if (resolvedNameNoExt.includes(fileNameNoExt) || fileNameNoExt.includes(resolvedNameNoExt) ||
            (relativeFilePath.includes(includedFileName) && relativeResolvedPath.includes(includedFileName))) {
          continue;
        }
        
        // Check if either file is an entry point - we need to handle require statements differently
        let isRequiredFileEntryPoint = false;
        let isCurrentFileEntryPoint = false;
        
        try {
          const includedFileContent = fs.readFileSync(resolvedPath, 'utf8');
          isRequiredFileEntryPoint = includedFileContent.includes('Plugin Name:') ||
                         includedFileContent.includes('Theme Name:');
                         
          const currentFileContent = fs.readFileSync(filePath, 'utf8');
          isCurrentFileEntryPoint = currentFileContent.includes('Plugin Name:') ||
                         currentFileContent.includes('Theme Name:');
        } catch (err) {
          // If we can't read the file, assume it's not an entry point
        }
        
        // Skip if the required file is an entry point - we don't want to annotate entry points
        if (isRequiredFileEntryPoint) {
          continue;
        }
        
        // Check if we would be creating a duplicate entry for same require
        const isDuplicate = symbols.some(s =>
          s.filePath === resolvedPath &&
          s.name === includedFileName.replace(/\.php$/, '') &&
          s.usages &&
          s.usages.some(u => u.filePath === filePath &&
            u.position.line === position.line)
        );

        if (!isDuplicate) {
          // Create a usage entry showing THIS file is using the INCLUDED file
          const usage: Usage = {
            filePath: filePath,
            position: position,
            range: {
              start: position,
              end: {
                line: position.line,
                character: position.character + requireMatch[0].length
              }
            },
            context: this.extractContext(content, requireMatch.index),
            type: 'reference'
          };
          
          // Create a virtual symbol for the included file
          const includedFileSymbolName = includedFileName.replace(/\.php$/, '');
          const symbol: Symbol = {
            id: `${resolvedPath}#file_ref_${Date.now()}`, // Unique ID
            name: includedFileSymbolName,
            type: 'class', // Use 'class' as it's a valid type
            // The symbol belongs to the INCLUDED file
            filePath: resolvedPath,
            position: { line: 0, character: 0 },
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 }
            },
            // The current file is using the included file
            usages: [usage]
          };
          
          symbols.push(symbol);
        }
      }
    }
  }

  findUsages(content: string, filePath: string, symbol: Symbol): Usage[] {
    const usages: Usage[] = [];
    
    // Simple usage detection based on name
    const usageRegex = new RegExp(`\\b${symbol.name}\\b`, 'g');
    let usageMatch;
    
    while ((usageMatch = usageRegex.exec(content)) !== null) {
      // Skip the definition itself
      if (symbol.filePath === filePath) {
        const positionInFile = this.getPositionFromOffset(content, usageMatch.index);
        if (positionInFile.line === symbol.position.line) {
          continue;
        }
      }
      
      const usagePosition = this.getPositionFromOffset(content, usageMatch.index);
      const usageEndPosition = this.getPositionFromOffset(content, usageMatch.index + symbol.name.length);
      
      const usage: Usage = {
        filePath,
        position: usagePosition,
        range: {
          start: usagePosition,
          end: usageEndPosition
        },
        context: this.extractContext(content, usageMatch.index),
        type: symbol.type === 'class' ? 'reference' : 'call'
      };
      
      usages.push(usage);
    }
    
    // WordPress hooks detection
    if (symbol.type === 'function') {
      // Look for add_action and add_filter with this function name as a callback
      const hookRegex = new RegExp(`(add_action|add_filter)\\(\\s*['"]([^'"]+)['"]\\s*,\\s*['"]${symbol.name}['"]`, 'g');
      let hookMatch;
      
      while ((hookMatch = hookRegex.exec(content)) !== null) {
        const hookType = hookMatch[1]; // add_action or add_filter
        const hookName = hookMatch[2]; // The hook name
        
        const usagePosition = this.getPositionFromOffset(content, hookMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, hookMatch.index + hookMatch[0].length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, hookMatch.index),
          type: 'call'
        };
        
        usages.push(usage);
      }
      
      // Look for array callbacks: add_action('hook', array($this, 'function_name'))
      const arrayCallbackRegex = new RegExp(`(add_action|add_filter)\\(\\s*['"]([^'"]+)['"]\\s*,\\s*array\\(\\s*\\$[^,]+\\s*,\\s*['"]${symbol.name}['"]\\s*\\)`, 'g');
      let arrayCallbackMatch;
      
      while ((arrayCallbackMatch = arrayCallbackRegex.exec(content)) !== null) {
        const hookType = arrayCallbackMatch[1]; // add_action or add_filter
        const hookName = arrayCallbackMatch[2]; // The hook name
        
        const usagePosition = this.getPositionFromOffset(content, arrayCallbackMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, arrayCallbackMatch.index + arrayCallbackMatch[0].length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, arrayCallbackMatch.index),
          type: 'call'
        };
        
        usages.push(usage);
      }
    }
    
    return usages;
  }
  
  // Helper function to extract PHP doc blocks
  private extractPhpDocBlock(content: string, position: number): string | undefined {
    const beforePosition = content.substring(0, position);
    const docBlockEndIndex = beforePosition.lastIndexOf('*/');
    
    if (docBlockEndIndex === -1) {
      return undefined;
    }
    
    const docBlockStartIndex = beforePosition.lastIndexOf('/**', docBlockEndIndex);
    
    if (docBlockStartIndex === -1) {
      return undefined;
    }
    
    // Check if there's only whitespace between doc block and class/function
    const betweenDocAndSymbol = beforePosition.substring(docBlockEndIndex + 2).trim();
    if (betweenDocAndSymbol) {
      return undefined;
    }
    
    return beforePosition.substring(docBlockStartIndex, docBlockEndIndex + 2).trim();
  }
}

class JsParserImpl extends LanguageParser {
  parseSymbols(content: string, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];
    const fileName = path.basename(filePath);
    
    // Find ES6 class declarations
    const classRegex = /class\s+(\w+)(?:\s+extends\s+(\w+))?/g;
    let classMatch;
    
    while ((classMatch = classRegex.exec(content)) !== null) {
      const className = classMatch[1];
      const classPosition = this.getPositionFromOffset(content, classMatch.index);
      const classBodyStart = content.indexOf('{', classMatch.index + classMatch[0].length);
      const classBodyStartPosition = this.getPositionFromOffset(content, classBodyStart);
      
      const classSymbol: Symbol = {
        id: this.generateSymbolId({
          name: className,
          filePath,
          position: classPosition
        }),
        name: className,
        type: 'class',
        filePath,
        position: classPosition,
        range: {
          start: classPosition,
          end: classBodyStartPosition
        },
        documentation: this.extractJsDocBlock(content, classMatch.index),
        usages: []
      };
      
      symbols.push(classSymbol);
    }
    
    // Find function declarations
    const functionRegex = /function\s+(\w+)\s*\([^)]*\)/g;
    let functionMatch;
    
    while ((functionMatch = functionRegex.exec(content)) !== null) {
      const functionName = functionMatch[1];
      const functionPosition = this.getPositionFromOffset(content, functionMatch.index);
      const functionBodyStart = content.indexOf('{', functionMatch.index + functionMatch[0].length);
      const functionBodyStartPosition = this.getPositionFromOffset(content, functionBodyStart);
      
      const functionSymbol: Symbol = {
        id: this.generateSymbolId({
          name: functionName,
          filePath,
          position: functionPosition
        }),
        name: functionName,
        type: 'function',
        filePath,
        position: functionPosition,
        range: {
          start: functionPosition,
          end: functionBodyStartPosition
        },
        documentation: this.extractJsDocBlock(content, functionMatch.index),
        usages: []
      };
      
      symbols.push(functionSymbol);
    }
    
    // Find arrow functions assigned to variables
    const arrowFunctionRegex = /const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=]+)=>\s*[{]/g;
    let arrowFunctionMatch;
    
    while ((arrowFunctionMatch = arrowFunctionRegex.exec(content)) !== null) {
      const functionName = arrowFunctionMatch[1];
      const functionPosition = this.getPositionFromOffset(content, arrowFunctionMatch.index);
      const arrowIndex = content.indexOf('=>', arrowFunctionMatch.index);
      const functionBodyStart = content.indexOf('{', arrowIndex);
      const functionBodyStartPosition = this.getPositionFromOffset(content, functionBodyStart);
      
      const functionSymbol: Symbol = {
        id: this.generateSymbolId({
          name: functionName,
          filePath,
          position: functionPosition
        }),
        name: functionName,
        type: 'function',
        filePath,
        position: functionPosition,
        range: {
          start: functionPosition,
          end: functionBodyStartPosition
        },
        documentation: this.extractJsDocBlock(content, arrowFunctionMatch.index),
        usages: []
      };
      
      symbols.push(functionSymbol);
    }
    
    return symbols;
  }

  findUsages(content: string, filePath: string, symbol: Symbol): Usage[] {
    const usages: Usage[] = [];
    
    // Use different patterns based on symbol type
    let usagePattern = symbol.name;
    if (symbol.type === 'function') {
      usagePattern = `${symbol.name}\\s*\\(`;
    }
    
    const usageRegex = new RegExp(`\\b${usagePattern}`, 'g');
    let usageMatch;
    
    while ((usageMatch = usageRegex.exec(content)) !== null) {
      // Skip the definition itself
      if (symbol.filePath === filePath) {
        const positionInFile = this.getPositionFromOffset(content, usageMatch.index);
        if (positionInFile.line === symbol.position.line) {
          continue;
        }
      }
      
      const usagePosition = this.getPositionFromOffset(content, usageMatch.index);
      const usageEndPosition = this.getPositionFromOffset(content, usageMatch.index + symbol.name.length);
      
      const usage: Usage = {
        filePath,
        position: usagePosition,
        range: {
          start: usagePosition,
          end: usageEndPosition
        },
        context: this.extractContext(content, usageMatch.index),
        type: symbol.type === 'class' ? 'reference' : 'call'
      };
      
      usages.push(usage);
    }
    
    return usages;
  }
  
  // Helper function to extract JSDoc blocks
  private extractJsDocBlock(content: string, position: number): string | undefined {
    const beforePosition = content.substring(0, position);
    const docBlockEndIndex = beforePosition.lastIndexOf('*/');
    
    if (docBlockEndIndex === -1) {
      return undefined;
    }
    
    const docBlockStartIndex = beforePosition.lastIndexOf('/**', docBlockEndIndex);
    
    if (docBlockStartIndex === -1) {
      return undefined;
    }
    
    // Check if there's only whitespace between doc block and class/function
    const betweenDocAndSymbol = beforePosition.substring(docBlockEndIndex + 2).trim();
    if (betweenDocAndSymbol) {
      return undefined;
    }
    
    return beforePosition.substring(docBlockStartIndex, docBlockEndIndex + 2).trim();
  }
}

class CssParserImpl extends LanguageParser {
  parseSymbols(content: string, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];
    
    // Find CSS selectors
    const selectorRegex = /([.#][\w-]+)(?:\s*[,{])/g;
    let selectorMatch;
    
    while ((selectorMatch = selectorRegex.exec(content)) !== null) {
      const selectorName = selectorMatch[1];
      const selectorPosition = this.getPositionFromOffset(content, selectorMatch.index);
      const selectorEndPosition = this.getPositionFromOffset(content, selectorMatch.index + selectorName.length);
      
      const selectorSymbol: Symbol = {
        id: this.generateSymbolId({
          name: selectorName,
          filePath,
          position: selectorPosition
        }),
        name: selectorName,
        type: 'selector',
        filePath,
        position: selectorPosition,
        range: {
          start: selectorPosition,
          end: selectorEndPosition
        },
        usages: []
      };
      
      symbols.push(selectorSymbol);
    }
    
    return symbols;
  }

  findUsages(content: string, filePath: string, symbol: Symbol): Usage[] {
    const usages: Usage[] = [];
    
    // Only process if this is a selector
    if (symbol.type === 'selector') {
      // Escape special characters in the selector
      const escapedSelector = symbol.name.replace(/[.#]/g, '\\$&');
      
      // Find querySelector/querySelectorAll with this selector
      const querySelectorRegex = new RegExp(`(document|element|\\w+)\\.(querySelector(?:All)?)\\(['"]${escapedSelector}['"]\\)`, 'g');
      let querySelectorMatch;
      
      while ((querySelectorMatch = querySelectorRegex.exec(content)) !== null) {
        const usagePosition = this.getPositionFromOffset(content, querySelectorMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, querySelectorMatch.index + querySelectorMatch[0].length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, querySelectorMatch.index),
          type: 'reference'
        };
        
        usages.push(usage);
      }
      
      // Find jQuery style selectors
      const jQueryRegex = new RegExp(`\\$\\(['"]${escapedSelector}['"]\\)`, 'g');
      let jQueryMatch;
      
      while ((jQueryMatch = jQueryRegex.exec(content)) !== null) {
        const usagePosition = this.getPositionFromOffset(content, jQueryMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, jQueryMatch.index + jQueryMatch[0].length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, jQueryMatch.index),
          type: 'reference'
        };
        
        usages.push(usage);
      }
      
      // Find addEventListener with event delegation
      const addEventRegex = new RegExp(`addEventListener\\(['"]\\w+['"].*${escapedSelector}`, 'g');
      let addEventMatch;
      
      while ((addEventMatch = addEventRegex.exec(content)) !== null) {
        const usagePosition = this.getPositionFromOffset(content, addEventMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, addEventMatch.index + addEventMatch[0].length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, addEventMatch.index),
          type: 'reference'
        };
        
        usages.push(usage);
      }
    }
    
    return usages;
  }
}

// Create and configure language parsers
export function createParsers() {
  return {
    '.php': new PhpParserImpl(),
    '.js': new JsParserImpl(),
    '.jsx': new JsParserImpl(),
    '.ts': new JsParserImpl(),
    '.tsx': new JsParserImpl(),
    '.css': new CssParserImpl(),
    '.scss': new CssParserImpl(),
    '.less': new CssParserImpl()
  };
}
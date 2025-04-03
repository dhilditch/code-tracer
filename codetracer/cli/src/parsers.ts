import { LanguageParser, Symbol, Usage } from 'codetracer-core';
import * as path from 'path';

// This file creates and configures parsers for different file types
class PhpParserImpl extends LanguageParser {
  parseSymbols(content: string, filePath: string): Symbol[] {
    const symbols: Symbol[] = [];
    const fileName = path.basename(filePath);
    
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
    // For CSS, we would look for class/id references in HTML files
    // This is a simplified implementation since we don't have HTML parsing here
    return [];
  }
}

/**
 * Create parsers for different file types
 */
export function createParsers() {
  return {
    '.php': new PhpParserImpl(),
    '.js': new JsParserImpl(),
    '.jsx': new JsParserImpl(),
    '.ts': new JsParserImpl(),
    '.tsx': new JsParserImpl(),
    '.css': new CssParserImpl(),
    '.scss': new CssParserImpl(),
    '.less': new CssParserImpl(),
  };
}
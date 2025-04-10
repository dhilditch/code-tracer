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
    
    // Create a file-level symbol to represent the entire PHP file
    const fileSymbol: Symbol = {
      id: this.generateSymbolId({
        name: fileName,
        filePath,
        position: {line: 0, character: 0}
      }),
      name: fileName,
      type: 'file',
      filePath,
      position: {line: 0, character: 0},
      range: {
        start: {line: 0, character: 0},
        end: {line: 0, character: 0}
      },
      usages: []
    };
    
    symbols.push(fileSymbol);
    
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
      
      // Find methods within this class
      this.findClassMethods(content, filePath, classPosition.line, symbols);
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
    
    // Find WordPress enqueue scripts and styles
    this.findEnqueueStatements(content, filePath, symbols);
    
    return symbols;
  }
  
  /**
   * Find class methods
   */
  private findClassMethods(content: string, filePath: string, classLineStart: number, symbols: Symbol[]): void {
    // Find the class body
    const lines = content.split('\n');
    let openBraces = 0;
    let inClass = false;
    let classBodyStart = -1;
    let classBodyEnd = -1;
    
    for (let i = classLineStart; i < lines.length; i++) {
      const line = lines[i];
      
      if (!inClass && line.includes('{')) {
        inClass = true;
        classBodyStart = i;
        openBraces = 1;
        continue;
      }
      
      if (inClass) {
        // Count braces to determine when the class ends
        for (let j = 0; j < line.length; j++) {
          if (line[j] === '{') openBraces++;
          if (line[j] === '}') openBraces--;
          
          if (openBraces === 0) {
            classBodyEnd = i;
            break;
          }
        }
        
        if (classBodyEnd !== -1) break;
      }
    }
    
    if (classBodyStart === -1 || classBodyEnd === -1) return;
    
    // Extract class body
    const classBody = lines.slice(classBodyStart, classBodyEnd + 1).join('\n');
    
    // Find methods in the class body
    const methodRegex = /function\s+(\w+)\s*\([^)]*\)/g;
    let methodMatch;
    
    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      const methodOffset = methodMatch.index;
      
      // Calculate the absolute position in the file
      const absoluteOffset = lines.slice(0, classBodyStart).join('\n').length + methodOffset;
      const methodPosition = this.getPositionFromOffset(content, absoluteOffset);
      
      // Find method body start
      const methodBodyStartIndex = classBody.indexOf('{', methodOffset + methodMatch[0].length);
      const absoluteBodyStartOffset = lines.slice(0, classBodyStart).join('\n').length + methodBodyStartIndex;
      const methodBodyStartPosition = this.getPositionFromOffset(content, absoluteBodyStartOffset);
      
      const methodSymbol: Symbol = {
        id: this.generateSymbolId({
          name: methodName,
          filePath,
          position: methodPosition
        }),
        name: methodName,
        type: 'method',
        filePath,
        position: methodPosition,
        range: {
          start: methodPosition,
          end: methodBodyStartPosition
        },
        documentation: this.extractPhpDocBlock(content, absoluteOffset),
        usages: []
      };
      
      symbols.push(methodSymbol);
    }
  }
  
  /**
   * Find WordPress enqueue statements for JS and CSS files
   */
  private findEnqueueStatements(content: string, filePath: string, symbols: Symbol[]): void {
    // Find wp_enqueue_script calls
    const scriptRegex = /(wp_enqueue_script|wp_register_script)\s*\(\s*['"]([^'"]+)['"][^,]*,\s*([^,]+)/g;
    let scriptMatch;
    
    while ((scriptMatch = scriptRegex.exec(content)) !== null) {
      const scriptHandle = scriptMatch[2];
      const scriptPath = scriptMatch[3];
      const position = this.getPositionFromOffset(content, scriptMatch.index);
      
      // Try to extract the actual script path
      let resolvedPath = '';
      
      // Common WordPress constants used in script paths
      const constants = {
        'SSC_PLUGIN_URL': 'admin',
        'plugin_dir_url(__FILE__)': ''
      };
      
      // Try to resolve the script path by replacing constants
      let processedPath = scriptPath.trim();
      
      for (const [constant, value] of Object.entries(constants)) {
        if (processedPath.includes(constant)) {
          processedPath = processedPath.replace(constant, value);
          break;
        }
      }
      
      // Remove quotes, concatenation, etc.
      processedPath = processedPath.replace(/['"\s\.]+/g, '');
      
      // Get the actual JS file name
      let jsFileName = '';
      
      if (processedPath.includes('admin/js/')) {
        jsFileName = processedPath.split('admin/js/').pop() || '';
      } else if (processedPath.includes('/js/')) {
        jsFileName = processedPath.split('/js/').pop() || '';
      }
      
      // Try to find the actual file in the project
      if (jsFileName) {
        // Find all JS files in the project that match this name
        const searchPattern = path.join(process.cwd(), '**', jsFileName);
        let foundFiles: string[] = [];
        
        try {
          const { globSync } = require('glob');
          foundFiles = globSync(searchPattern);
        } catch (error) {
          // Fallback to a less efficient method
          // Just check in common locations
          const commonLocations = [
            path.join(path.dirname(filePath), 'js', jsFileName),
            path.join(path.dirname(filePath), '../js', jsFileName),
            path.join(path.dirname(filePath), 'admin/js', jsFileName),
            path.join(path.dirname(filePath), '../admin/js', jsFileName)
          ];
          
          foundFiles = commonLocations.filter(loc => fs.existsSync(loc));
        }
        
        // Use the first match if found
        if (foundFiles.length > 0) {
          resolvedPath = foundFiles[0];
          
          // Create a usage entry showing THIS file is using the JS file
          const usage: Usage = {
            filePath: filePath,
            position: position,
            range: {
              start: position,
              end: {
                line: position.line,
                character: position.character + scriptMatch[0].length
              }
            },
            context: this.extractContext(content, scriptMatch.index),
            type: 'inclusion'
          };
          
          // Create a virtual symbol for the JS file
          const jsFileName = path.basename(resolvedPath);
          const symbol: Symbol = {
            id: `${resolvedPath}#file_ref_${Date.now()}`, // Unique ID
            name: jsFileName,
            type: 'file',
            filePath: resolvedPath,
            position: { line: 0, character: 0 },
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 }
            },
            usages: [usage]
          };
          
          symbols.push(symbol);
        }
      }
    }
    
    // Find wp_enqueue_style calls
    const styleRegex = /(wp_enqueue_style|wp_register_style)\s*\(\s*['"]([^'"]+)['"][^,]*,\s*([^,]+)/g;
    let styleMatch;
    
    while ((styleMatch = styleRegex.exec(content)) !== null) {
      const styleHandle = styleMatch[2];
      const stylePath = styleMatch[3];
      const position = this.getPositionFromOffset(content, styleMatch.index);
      
      // Similar to script processing, try to extract the actual CSS path
      let resolvedPath = '';
      
      // Common WordPress constants used in style paths
      const constants = {
        'SSC_PLUGIN_URL': 'admin',
        'plugin_dir_url(__FILE__)': ''
      };
      
      // Try to resolve the style path by replacing constants
      let processedPath = stylePath.trim();
      
      for (const [constant, value] of Object.entries(constants)) {
        if (processedPath.includes(constant)) {
          processedPath = processedPath.replace(constant, value);
          break;
        }
      }
      
      // Remove quotes, concatenation, etc.
      processedPath = processedPath.replace(/['"\s\.]+/g, '');
      
      // Get the actual CSS file name
      let cssFileName = '';
      
      if (processedPath.includes('admin/css/')) {
        cssFileName = processedPath.split('admin/css/').pop() || '';
      } else if (processedPath.includes('/css/')) {
        cssFileName = processedPath.split('/css/').pop() || '';
      }
      
      // Try to find the actual file in the project
      if (cssFileName) {
        // Find all CSS files in the project that match this name
        const searchPattern = path.join(process.cwd(), '**', cssFileName);
        let foundFiles: string[] = [];
        
        try {
          const { globSync } = require('glob');
          foundFiles = globSync(searchPattern);
        } catch (error) {
          // Fallback to a less efficient method
          // Just check in common locations
          const commonLocations = [
            path.join(path.dirname(filePath), 'css', cssFileName),
            path.join(path.dirname(filePath), '../css', cssFileName),
            path.join(path.dirname(filePath), 'admin/css', cssFileName),
            path.join(path.dirname(filePath), '../admin/css', cssFileName)
          ];
          
          foundFiles = commonLocations.filter(loc => fs.existsSync(loc));
        }
        
        // Use the first match if found
        if (foundFiles.length > 0) {
          resolvedPath = foundFiles[0];
          
          // Create a usage entry showing THIS file is using the CSS file
          const usage: Usage = {
            filePath: filePath,
            position: position,
            range: {
              start: position,
              end: {
                line: position.line,
                character: position.character + styleMatch[0].length
              }
            },
            context: this.extractContext(content, styleMatch.index),
            type: 'inclusion'
          };
          
          // Create a virtual symbol for the CSS file
          const cssFileName = path.basename(resolvedPath);
          const symbol: Symbol = {
            id: `${resolvedPath}#file_ref_${Date.now()}`, // Unique ID
            name: cssFileName,
            type: 'file',
            filePath: resolvedPath,
            position: { line: 0, character: 0 },
            range: {
              start: { line: 0, character: 0 },
              end: { line: 0, character: 0 }
            },
            usages: [usage]
          };
          
          symbols.push(symbol);
        }
      }
    }
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
            type: 'inclusion'
          };
          
          // Create a virtual symbol for the included file
          const includedFileSymbolName = includedFileName.replace(/\.php$/, '');
          const symbol: Symbol = {
            id: `${resolvedPath}#file_ref_${Date.now()}`, // Unique ID
            name: includedFileSymbolName,
            type: 'file',
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
    
    // For file type symbols
    if (symbol.type === 'file') {
      // Check for includes in PHP files
      if (symbol.filePath.endsWith('.php')) {
        const phpIncludeRegex = /(require|require_once|include|include_once)\s*\(\s*['"]([^'"]+)['"].*\)/g;
        let includeMatch;
        
        const fileName = path.basename(symbol.filePath);
        
        while ((includeMatch = phpIncludeRegex.exec(content)) !== null) {
          const includePath = includeMatch[2];
          
          // Check if this include statement refers to our file
          if (includePath.includes(fileName)) {
            const usagePosition = this.getPositionFromOffset(content, includeMatch.index);
            const usageEndPosition = this.getPositionFromOffset(content, includeMatch.index + includeMatch[0].length);
            
            const usage: Usage = {
              filePath,
              position: usagePosition,
              range: {
                start: usagePosition,
                end: usageEndPosition
              },
              context: this.extractContext(content, includeMatch.index),
              type: 'inclusion'
            };
            
            usages.push(usage);
          }
        }
      }
      
      // Check for HTML elements in PHP files that JS might use
      if (symbol.filePath.endsWith('.js') && (filePath.endsWith('.php') || filePath.endsWith('.html'))) {
        // Read the JS file to find DOM selectors
        try {
          const jsContent = fs.readFileSync(symbol.filePath, 'utf8');
          
          // Extract all DOM selector patterns
          const selectorPatterns: string[] = [];
          
          // jQuery selectors like $('#id') or $('.class')
          const jQueryRegex = /\$\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
          let jQueryMatch;
          
          while ((jQueryMatch = jQueryRegex.exec(jsContent)) !== null) {
            const selector = jQueryMatch[1];
            if (selector.startsWith('#') || selector.startsWith('.')) {
              selectorPatterns.push(selector.substring(1)); // Remove # or .
            }
          }
          
          // Check for these selectors in HTML/PHP content
          if (selectorPatterns.length > 0) {
            // Check for IDs
            const idRegex = /id\s*=\s*["']([^"']+)["']/g;
            let idMatch;
            
            while ((idMatch = idRegex.exec(content)) !== null) {
              const id = idMatch[1];
              
              if (selectorPatterns.includes(id)) {
                const usagePosition = this.getPositionFromOffset(content, idMatch.index);
                const usageEndPosition = this.getPositionFromOffset(content, idMatch.index + idMatch[0].length);
                
                const usage: Usage = {
                  filePath,
                  position: usagePosition,
                  range: {
                    start: usagePosition,
                    end: usageEndPosition
                  },
                  context: this.extractContext(content, idMatch.index),
                  type: 'reference'
                };
                
                usages.push(usage);
              }
            }
            
            // Check for classes
            const classRegex = /class\s*=\s*["']([^"']+)["']/g;
            let classMatch;
            
            while ((classMatch = classRegex.exec(content)) !== null) {
              const classes = classMatch[1].split(/\s+/);
              
              for (const cls of classes) {
                if (selectorPatterns.includes(cls)) {
                  const usagePosition = this.getPositionFromOffset(content, classMatch.index);
                  const usageEndPosition = this.getPositionFromOffset(content, classMatch.index + classMatch[0].length);
                  
                  const usage: Usage = {
                    filePath,
                    position: usagePosition,
                    range: {
                      start: usagePosition,
                      end: usageEndPosition
                    },
                    context: this.extractContext(content, classMatch.index),
                    type: 'reference'
                  };
                  
                  usages.push(usage);
                  break; // Only add one usage per class attribute
                }
              }
            }
          }
        } catch (error) {
          // Skip if we can't read the JS file
        }
      }
      
      return usages;
    }
    
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
    if (symbol.type === 'function' || symbol.type === 'method') {
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
      const arrayCallbackRegex = new RegExp(`(add_action|add_filter)\\(\\s*['"]([^'"]+)['"]\\s*,\\s*array\\(\\s*\\$?[^,]+\\s*,\\s*['"]${symbol.name}['"]\\s*\\)`, 'g');
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
    
    // Find global objects like window.SSC_Features
    const globalObjectRegex = /window\.([\w_]+)\s*=\s*/g;
    let globalObjectMatch;
    
    while ((globalObjectMatch = globalObjectRegex.exec(content)) !== null) {
      const objectName = globalObjectMatch[1];
      const objectPosition = this.getPositionFromOffset(content, globalObjectMatch.index);
      const objectBodyStart = content.indexOf('{', globalObjectMatch.index + globalObjectMatch[0].length);
      const objectBodyStartPosition = this.getPositionFromOffset(content, objectBodyStart);
      
      const objectSymbol: Symbol = {
        id: this.generateSymbolId({
          name: objectName,
          filePath,
          position: objectPosition
        }),
        name: objectName,
        type: 'class', // Treat global objects as classes for simplicity
        filePath,
        position: objectPosition,
        range: {
          start: objectPosition,
          end: objectBodyStartPosition
        },
        documentation: this.extractJsDocBlock(content, globalObjectMatch.index),
        usages: []
      };
      
      symbols.push(objectSymbol);
    }

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
    
    // Find object methods
    const methodRegex = /(\w+)\s*:\s*function\s*\(/g;
    let methodMatch;
    
    while ((methodMatch = methodRegex.exec(content)) !== null) {
      const methodName = methodMatch[1];
      const methodPosition = this.getPositionFromOffset(content, methodMatch.index);
      const methodBodyStart = content.indexOf('{', methodMatch.index + methodMatch[0].length);
      const methodBodyStartPosition = this.getPositionFromOffset(content, methodBodyStart);
      
      const methodSymbol: Symbol = {
        id: this.generateSymbolId({
          name: methodName,
          filePath,
          position: methodPosition
        }),
        name: methodName,
        type: 'method',
        filePath,
        position: methodPosition,
        range: {
          start: methodPosition,
          end: methodBodyStartPosition
        },
        documentation: this.extractJsDocBlock(content, methodMatch.index),
        usages: []
      };
      
      symbols.push(methodSymbol);
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
    
    // Create a special file-level symbol to represent the entire JS file
    // This will be used to track which PHP files include this JS file
    const fileSymbol: Symbol = {
      id: this.generateSymbolId({
        name: fileName,
        filePath,
        position: {line: 0, character: 0}
      }),
      name: fileName,
      type: 'file',
      filePath,
      position: {line: 0, character: 0},
      range: {
        start: {line: 0, character: 0},
        end: {line: 0, character: 0}
      },
      usages: []
    };
    
    symbols.push(fileSymbol);
    
    return symbols;
  }

  findUsages(content: string, filePath: string, symbol: Symbol): Usage[] {
    const usages: Usage[] = [];
    
    // For file type symbols, check if this file is included by PHP files
    if (symbol.type === 'file') {
      // Pattern to detect JS file inclusions in PHP files
      const jsFilePattern = path.basename(symbol.filePath);
      const phpIncludeRegex = new RegExp(`(wp_enqueue_script|wp_register_script)\\s*\\([^)]*['"]([^'"]*${jsFilePattern})['"]`, 'g');
      let includeMatch;
      
      while ((includeMatch = phpIncludeRegex.exec(content)) !== null) {
        const usagePosition = this.getPositionFromOffset(content, includeMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, includeMatch.index + includeMatch[0].length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, includeMatch.index),
          type: 'inclusion'
        };
        
        usages.push(usage);
      }
      
      // Check for HTML elements with IDs or classes that JS might interact with
      if (filePath.endsWith('.php')) {
        const htmlIdRegex = /id\s*=\s*["']([^"']+)["']/g;
        let idMatch;
        
        while ((idMatch = htmlIdRegex.exec(content)) !== null) {
          // Check if this ID is referenced in the JS file
          const idValue = idMatch[1];
          const jsContent = fs.readFileSync(symbol.filePath, 'utf8');
          
          if (jsContent.includes(`'#${idValue}'`) || jsContent.includes(`"#${idValue}"`) ||
              jsContent.includes(`$('#${idValue}')`) || jsContent.includes(`$("#${idValue}")`)) {
            const usagePosition = this.getPositionFromOffset(content, idMatch.index);
            const usageEndPosition = this.getPositionFromOffset(content, idMatch.index + idMatch[0].length);
            
            const usage: Usage = {
              filePath,
              position: usagePosition,
              range: {
                start: usagePosition,
                end: usageEndPosition
              },
              context: this.extractContext(content, idMatch.index),
              type: 'reference'
            };
            
            usages.push(usage);
          }
        }
        
        // Check for CSS classes used in the JS
        const classRegex = /class\s*=\s*["']([^"']+)["']/g;
        let classMatch;
        
        while ((classMatch = classRegex.exec(content)) !== null) {
          const classValue = classMatch[1].split(/\s+/);
          const jsContent = fs.readFileSync(symbol.filePath, 'utf8');
          
          for (const cssClass of classValue) {
            if (jsContent.includes(`'.${cssClass}'`) || jsContent.includes(`".${cssClass}"`) ||
                jsContent.includes(`$('.${cssClass}')`) || jsContent.includes(`$(".${cssClass}")`)) {
              const usagePosition = this.getPositionFromOffset(content, classMatch.index);
              const usageEndPosition = this.getPositionFromOffset(content, classMatch.index + classMatch[0].length);
              
              const usage: Usage = {
                filePath,
                position: usagePosition,
                range: {
                  start: usagePosition,
                  end: usageEndPosition
                },
                context: this.extractContext(content, classMatch.index),
                type: 'reference'
              };
              
              usages.push(usage);
              break; // Only add one usage per class attribute
            }
          }
        }
      }
      
      return usages;
    }
    
    // Regular symbol usage detection
    // Use different patterns based on symbol type
    let usagePattern = symbol.name;
    if (symbol.type === 'function' || symbol.type === 'method') {
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
    
    // Look for object property access like SSC_Features.init()
    if (symbol.type === 'class' && symbol.name.startsWith('SSC_')) {
      const objUsageRegex = new RegExp(`${symbol.name}\\.([\\w]+)`, 'g');
      let objUsageMatch;
      
      while ((objUsageMatch = objUsageRegex.exec(content)) !== null) {
        // Skip the definition itself
        if (symbol.filePath === filePath) {
          const positionInFile = this.getPositionFromOffset(content, objUsageMatch.index);
          if (positionInFile.line === symbol.position.line) {
            continue;
          }
        }
        
        const usagePosition = this.getPositionFromOffset(content, objUsageMatch.index);
        const usageEndPosition = this.getPositionFromOffset(content, objUsageMatch.index + symbol.name.length);
        
        const usage: Usage = {
          filePath,
          position: usagePosition,
          range: {
            start: usagePosition,
            end: usageEndPosition
          },
          context: this.extractContext(content, objUsageMatch.index),
          type: 'reference'
        };
        
        usages.push(usage);
      }
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
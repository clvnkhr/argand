import { Token, ASTNode, ParseContext, MathFunction } from '../types/expressions';
import { ComplexNumber } from '../types/complex';

export class ExpressionParser {
  private functions: Map<string, MathFunction> = new Map();
  private variables: Map<string, ComplexNumber> = new Map();

  constructor() {
    this.initializeFunctions();
  }

  private initializeFunctions() {
    // Basic complex functions
    this.functions.set('Re', {
      name: 'Re',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return z.real;
      },
      description: 'Real part of complex number'
    });

    this.functions.set('Im', {
      name: 'Im',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return z.imaginary;
      },
      description: 'Imaginary part of complex number'
    });

    this.functions.set('abs', {
      name: 'abs',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
      },
      description: 'Modulus of complex number'
    });

    this.functions.set('arg', {
      name: 'arg',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return Math.atan2(z.imaginary, z.real);
      },
      description: 'Argument of complex number'
    });

    this.functions.set('conj', {
      name: 'conj',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return { real: z.real, imaginary: -z.imaginary };
      },
      description: 'Complex conjugate'
    });

    this.functions.set('exp', {
      name: 'exp',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        const expReal = Math.exp(z.real);
        return {
          real: expReal * Math.cos(z.imaginary),
          imaginary: expReal * Math.sin(z.imaginary)
        };
      },
      description: 'Exponential function'
    });

    this.functions.set('log', {
      name: 'log',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        const r = Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
        const theta = Math.atan2(z.imaginary, z.real);
        return {
          real: Math.log(r),
          imaginary: theta
        };
      },
      description: 'Natural logarithm'
    });

    this.functions.set('sqrt', {
      name: 'sqrt',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        const r = Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
        const theta = Math.atan2(z.imaginary, z.real);
        const sqrtR = Math.sqrt(r);
        return {
          real: sqrtR * Math.cos(theta / 2),
          imaginary: sqrtR * Math.sin(theta / 2)
        };
      },
      description: 'Square root'
    });

    // Trigonometric functions
    this.functions.set('sin', {
      name: 'sin',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return {
          real: Math.sin(z.real) * Math.cosh(z.imaginary),
          imaginary: Math.cos(z.real) * Math.sinh(z.imaginary)
        };
      },
      description: 'Sine function'
    });

    this.functions.set('cos', {
      name: 'cos',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        return {
          real: Math.cos(z.real) * Math.cosh(z.imaginary),
          imaginary: -Math.sin(z.real) * Math.sinh(z.imaginary)
        };
      },
      description: 'Cosine function'
    });

    this.functions.set('tan', {
      name: 'tan',
      argCount: 1,
      evaluate: (args) => {
        const z = args[0] as ComplexNumber;
        const sin = {
          real: Math.sin(z.real) * Math.cosh(z.imaginary),
          imaginary: Math.cos(z.real) * Math.sinh(z.imaginary)
        };
        const cos = {
          real: Math.cos(z.real) * Math.cosh(z.imaginary),
          imaginary: -Math.sin(z.real) * Math.sinh(z.imaginary)
        };
        // Complex division: sin/cos
        const denominator = cos.real * cos.real + cos.imaginary * cos.imaginary;
        return {
          real: (sin.real * cos.real + sin.imaginary * cos.imaginary) / denominator,
          imaginary: (sin.imaginary * cos.real - sin.real * cos.imaginary) / denominator
        };
      },
      description: 'Tangent function'
    });
  }

  setVariable(name: string, value: ComplexNumber) {
    this.variables.set(name, value);
  }

  getVariable(name: string): ComplexNumber | undefined {
    return this.variables.get(name);
  }

  // Tokenize the expression
  tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;

    while (position < expression.length) {
      const char = expression[position];

      // Skip whitespace
      if (/\s/.test(char)) {
        position++;
        continue;
      }

      // Numbers (including complex numbers like 2+3i)
      if (/[0-9.]/.test(char)) {
        let numberStr = '';
        let hasDecimal = false;

        while (position < expression.length && (/[0-9.]/.test(expression[position]))) {
          if (expression[position] === '.') {
            if (hasDecimal) break;
            hasDecimal = true;
          }
          numberStr += expression[position];
          position++;
        }

        // Check for imaginary unit
        if (position < expression.length && expression[position] === 'i') {
          if (numberStr === '' || numberStr === '.') {
            numberStr = '1';
          }
          tokens.push({
            type: 'IMAGINARY',
            value: numberStr,
            position: position - numberStr.length
          });
          position++;
        } else {
          tokens.push({
            type: 'NUMBER',
            value: numberStr,
            position: position - numberStr.length
          });
        }
        continue;
      }

      // Note: Imaginary unit 'i' is now handled in the variable section

      // Variables (letters and underscores for complex numbers)
      if (/[a-zA-Z_]/.test(char)) {
        let varName = '';
        while (position < expression.length && /[a-zA-Z_]/.test(expression[position])) {
          varName += expression[position];
          position++;
        }

        // Special case: if we just read 'i' by itself, treat it as IMAGINARY token
        if (varName === 'i') {
          tokens.push({
            type: 'IMAGINARY',
            value: '1',
            position: position - 1
          });
        } else {
          // Check if it's a function
          if (position < expression.length && expression[position] === '(') {
            tokens.push({
              type: 'FUNCTION',
              value: varName,
              position: position - varName.length
            });
          } else {
            tokens.push({
              type: 'VARIABLE',
              value: varName,
              position: position - varName.length
            });
          }
        }
        continue;
      }

      // Operators
      if (char === '+') {
        tokens.push({ type: 'OPERATOR', value: '+', position });
        position++;
      } else if (char === '-') {
        tokens.push({ type: 'OPERATOR', value: '-', position });
        position++;
      } else if (char === '*') {
        tokens.push({ type: 'OPERATOR', value: '*', position });
        position++;
      } else if (char === '/') {
        tokens.push({ type: 'OPERATOR', value: '/', position });
        position++;
      } else if (char === '^') {
        tokens.push({ type: 'POWER', value: '^', position });
        position++;
      } else if (char === '|') {
        tokens.push({ type: 'MODULUS', value: '|', position });
        position++;
      } else if (char === '(') {
        tokens.push({ type: 'PARENOPEN', value: '(', position });
        position++;
      } else if (char === ')') {
        tokens.push({ type: 'PARENCLOSE', value: ')', position });
        position++;
      } else if (char === '=') {
        if (position + 1 < expression.length && expression[position + 1] === '=') {
          tokens.push({ type: 'COMPARISON', value: '==', position });
          position += 2;
        } else {
          tokens.push({ type: 'EQUALS', value: '=', position });
          position++;
        }
      } else if (char === '<' || char === '>') {
        let comp = char;
        const startPos = position;
        position++;
        if (position < expression.length && expression[position] === '=') {
          comp += '=';
          position++;
        }
        tokens.push({ type: 'COMPARISON', value: comp, position: startPos });
      } else if (char === ',') {
        tokens.push({ type: 'COMMA', value: ',', position });
        position++;
      } else if (char === ';') {
        tokens.push({ type: 'SEMICOLON', value: ';', position });
        position++;
      } else {
        tokens.push({ type: 'UNKNOWN', value: char, position });
        position++;
      }
    }

    return tokens;
  }

  // Parse tokens into AST
  parse(tokens: Token[]): { ast: ASTNode; error?: string } {
    const context: ParseContext = {
      variables: this.variables,
      currentPosition: 0,
      tokens
    };

    try {
      const ast = this.parseExpression(context);

      if (context.currentPosition < tokens.length) {
        return {
          ast,
          error: `Unexpected token at position ${context.currentPosition}: ${tokens[context.currentPosition].value}`
        };
      }

      return { ast };
    } catch (error) {
      return {
        ast: { type: 'number' } as ASTNode,
        error: error instanceof Error ? error.message : 'Parse error'
      };
    }
  }

  private parseExpression(context: ParseContext): ASTNode {
    return this.parseEquality(context);
  }

  private parseEquality(context: ParseContext): ASTNode {
    let left = this.parseRelational(context);

    while (context.currentPosition < context.tokens.length) {
      const token = context.tokens[context.currentPosition];

      if (token.type === 'EQUALS' || (token.type === 'COMPARISON' && ['==', '!='].includes(token.value))) {
        context.currentPosition++;
        const right = this.parseRelational(context);
        left = {
          type: 'binary',
          operator: token.value,
          left,
          right
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseRelational(context: ParseContext): ASTNode {
    let left = this.parseAdditive(context);

    while (context.currentPosition < context.tokens.length) {
      const token = context.tokens[context.currentPosition];

      if (token.type === 'COMPARISON' && ['<', '>', '<=', '>='].includes(token.value)) {
        context.currentPosition++;
        const right = this.parseAdditive(context);
        left = {
          type: 'binary',
          operator: token.value,
          left,
          right
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseAdditive(context: ParseContext): ASTNode {
    let left = this.parseMultiplicative(context);

    while (context.currentPosition < context.tokens.length) {
      const token = context.tokens[context.currentPosition];

      if (token.type === 'OPERATOR' && ['+', '-'].includes(token.value)) {
        context.currentPosition++;
        const right = this.parseMultiplicative(context);
        left = {
          type: 'binary',
          operator: token.value,
          left,
          right
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parseMultiplicative(context: ParseContext): ASTNode {
    let left = this.parsePower(context);

    while (context.currentPosition < context.tokens.length) {
      const token = context.tokens[context.currentPosition];

      if (token.type === 'OPERATOR' && ['*', '/'].includes(token.value)) {
        context.currentPosition++;
        const right = this.parsePower(context);
        left = {
          type: 'binary',
          operator: token.value,
          left,
          right
        };
      } else {
        break;
      }
    }

    return left;
  }

  private parsePower(context: ParseContext): ASTNode {
    let left = this.parseUnary(context);

    if (context.currentPosition < context.tokens.length &&
        context.tokens[context.currentPosition].type === 'POWER') {
      context.currentPosition++;
      const right = this.parsePower(context); // Right-associative
      left = {
        type: 'binary',
        operator: '^',
        left,
        right
      };
    }

    return left;
  }

  private parseUnary(context: ParseContext): ASTNode {
    const token = context.tokens[context.currentPosition];

    if (token.type === 'OPERATOR' && ['+', '-'].includes(token.value)) {
      context.currentPosition++;
      const operand = this.parseUnary(context);
      return {
        type: 'unary',
        operator: token.value,
        operand
      };
    }

    return this.parseModulus(context);
  }

  private parseModulus(context: ParseContext): ASTNode {
    if (context.currentPosition < context.tokens.length &&
        context.tokens[context.currentPosition].type === 'MODULUS') {

      // Find matching closing modulus
      const openPos = context.currentPosition;
      context.currentPosition++; // Skip opening |

      const inside = this.parseExpression(context);

      if (context.currentPosition >= context.tokens.length ||
          context.tokens[context.currentPosition].type !== 'MODULUS') {
        throw new Error(`Unclosed modulus at position ${openPos}`);
      }

      context.currentPosition++; // Skip closing |

      return {
        type: 'modulus',
        operand: inside
      };
    }

    return this.parsePrimary(context);
  }

  private parsePrimary(context: ParseContext): ASTNode {
    const token = context.tokens[context.currentPosition];

    if (!token) {
      throw new Error('Unexpected end of expression');
    }

    switch (token.type) {
      case 'NUMBER':
        context.currentPosition++;
        return {
          type: 'number',
          value: parseFloat(token.value)
        };

      case 'IMAGINARY':
        context.currentPosition++;
        return {
          type: 'imaginary',
          value: parseFloat(token.value)
        };

      case 'VARIABLE':
        context.currentPosition++;
        return {
          type: 'variable',
          value: token.value
        };

      case 'FUNCTION':
        return this.parseFunction(context);

      case 'PARENOPEN':
        context.currentPosition++;
        const expr = this.parseExpression(context);

        if (context.currentPosition >= context.tokens.length ||
            context.tokens[context.currentPosition].type !== 'PARENCLOSE') {
          throw new Error('Unclosed parenthesis');
        }

        context.currentPosition++;
        return expr;

      default:
        throw new Error(`Unexpected token: ${token.value} at position ${token.position}`);
    }
  }

  private parseFunction(context: ParseContext): ASTNode {
    const token = context.tokens[context.currentPosition];
    if (token.type !== 'FUNCTION') {
      throw new Error('Expected function');
    }

    const funcName = token.value;
    const func = this.functions.get(funcName);

    if (!func) {
      throw new Error(`Unknown function: ${funcName}`);
    }

    context.currentPosition++; // Skip function name

    if (context.currentPosition >= context.tokens.length ||
        context.tokens[context.currentPosition].type !== 'PARENOPEN') {
      throw new Error(`Expected '(' after function ${funcName}`);
    }

    context.currentPosition++; // Skip opening parenthesis

    const args: ASTNode[] = [];

    if (context.currentPosition < context.tokens.length &&
        context.tokens[context.currentPosition].type !== 'PARENCLOSE') {

      args.push(this.parseExpression(context));

      while (context.currentPosition < context.tokens.length) {
        const currentToken = context.tokens[context.currentPosition];

        if (currentToken.type === 'COMMA') {
          context.currentPosition++;
          args.push(this.parseExpression(context));
        } else if (currentToken.type === 'PARENCLOSE') {
          break;
        } else {
          throw new Error(`Expected ',' or ')' in function arguments`);
        }
      }
    }

    if (context.currentPosition >= context.tokens.length ||
        context.tokens[context.currentPosition].type !== 'PARENCLOSE') {
      throw new Error(`Unclosed function call for ${funcName}`);
    }

    if (args.length !== func.argCount) {
      throw new Error(`Function ${funcName} expects ${func.argCount} arguments, got ${args.length}`);
    }

    context.currentPosition++; // Skip closing parenthesis

    return {
      type: 'function',
      value: funcName,
      args
    };
  }

  // Public method to parse expression string
  parseExpressionString(expression: string): { ast: ASTNode; error?: string } {
    const tokens = this.tokenize(expression);
    return this.parse(tokens);
  }
}
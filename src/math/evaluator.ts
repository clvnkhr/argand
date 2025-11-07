import { ASTNode, EvaluationResult } from '../types/expressions';
import { ComplexNumber } from '../types/complex';
import {
  addComplex,
  subtractComplex,
  multiplyComplex,
  divideComplex,
  expComplex,
  logComplex,
  sqrtComplex,
  sinComplex,
  cosComplex,
  tanComplex,
  conjComplex,
  complexModulus
} from '../utils/complex';

export type ComplexOrNumber = ComplexNumber | number;

export class ExpressionEvaluator {
  private variables: Map<string, ComplexNumber> = new Map();

  setVariable(name: string, value: ComplexNumber) {
    this.variables.set(name, value);
  }

  getVariable(name: string): ComplexNumber | undefined {
    return this.variables.get(name);
  }

  
  private powerComplex(base: ComplexNumber, exponent: ComplexNumber): ComplexNumber {
    // Handle real integer exponents efficiently
    if (base.imaginary === 0 && exponent.imaginary === 0 && Number.isInteger(exponent.real)) {
      return this.powerReal(base.real, Math.floor(exponent.real));
    }

    // General case: a^b = exp(b * log(a))
    const logBase = logComplex(base);
    const product = this.multiplyComplexScalar(logBase, exponent);
    return expComplex(product);
  }

  private powerReal(base: number, exponent: number): ComplexNumber {
    if (exponent >= 0) {
      let result = { real: 1, imaginary: 0 };
      for (let i = 0; i < exponent; i++) {
        result = multiplyComplex(result, { real: base, imaginary: 0 });
      }
      return result;
    } else {
      return this.powerReal(base, -exponent);
    }
  }

  private multiplyComplexScalar(z: ComplexNumber, scalar: ComplexNumber): ComplexNumber {
    if (z.imaginary === 0 && scalar.imaginary === 0) {
      return {
        real: z.real * scalar.real,
        imaginary: 0
      };
    }
    return multiplyComplex(z, scalar);
  }

  // Evaluate AST node
  evaluate(node: ASTNode, z?: ComplexNumber): EvaluationResult {
    try {
      switch (node.type) {
        case 'number':
          return {
            value: node.value as number,
            isValid: true
          };

        case 'imaginary':
          return {
            value: { real: 0, imaginary: node.value as number },
            isValid: true
          };

        case 'variable':
          if (node.value === 'z' && z) {
            return {
              value: z,
              isValid: true
            };
          }

          // Handle x as alias for Re(z)
          if (node.value === 'x' && z) {
            return {
              value: z.real,
              isValid: true
            };
          }

          // Handle y as alias for Im(z)
          if (node.value === 'y' && z) {
            return {
              value: z.imaginary,
              isValid: true
            };
          }

          // Handle the imaginary unit i
          if (node.value === 'i') {
            return {
              value: { real: 0, imaginary: 1 },
              isValid: true
            };
          }

          {
            const variable = this.variables.get(String(node.value));
            if (variable) {
              return {
                value: variable,
                isValid: true
              };
            }
          }

          return {
            value: { real: 0, imaginary: 0 },
            isValid: false,
            error: `Unknown variable: ${node.value}`
          };

        case 'binary':
          return this.evaluateBinary(node, z);

        case 'unary':
          return this.evaluateUnary(node, z);

        case 'function':
          return this.evaluateFunction(node, z);

        case 'modulus': {
        const operandResult = this.evaluate(node.operand!, z);
        if (!operandResult.isValid) {
          return operandResult;
        }

        const operand = this.toComplex(operandResult.value);
        const modulus = complexModulus(operand);

        return {
          value: modulus,
          isValid: true
        };
      }

        default:
          return {
            value: { real: 0, imaginary: 0 },
            isValid: false,
            error: `Unknown node type: ${(node as { type: string }).type}`
          };
      }
    } catch (error) {
      return {
        value: { real: 0, imaginary: 0 },
        isValid: false,
        error: error instanceof Error ? error.message : 'Evaluation error'
      };
    }
  }

  private evaluateBinary(node: ASTNode, z?: ComplexNumber): EvaluationResult {
    const leftResult = this.evaluate(node.left!, z);
    if (!leftResult.isValid) {
      return leftResult;
    }

    const rightResult = this.evaluate(node.right!, z);
    if (!rightResult.isValid) {
      return rightResult;
    }

    // Handle comparison operators (return boolean)
    if (['=', '==', '!=', '<', '>', '<=', '>='].includes(node.operator!)) {
      return this.evaluateComparison(leftResult, rightResult, node.operator!);
    }

    // Handle arithmetic operators
    const left = this.toComplex(leftResult.value);
    const right = this.toComplex(rightResult.value);

    let result: ComplexNumber;

    switch (node.operator) {
      case '+':
        result = addComplex(left, right);
        break;
      case '-':
        result = subtractComplex(left, right);
        break;
      case '*':
        result = multiplyComplex(left, right);
        break;
      case '/':
        result = divideComplex(left, right);
        break;
      case '^':
        result = this.powerComplex(left, right);
        break;
      default:
        return {
          value: { real: 0, imaginary: 0 },
          isValid: false,
          error: `Unknown binary operator: ${node.operator}`
        };
    }

    // Return real number if result has zero imaginary part
    if (Math.abs(result.imaginary) < 1e-10) {
      return {
        value: result.real,
        isValid: true
      };
    }

    return {
      value: result,
      isValid: true
    };
  }

  private evaluateUnary(node: ASTNode, z?: ComplexNumber): EvaluationResult {
    const operandResult = this.evaluate(node.operand!, z);
    if (!operandResult.isValid) {
      return operandResult;
    }

    const operand = this.toComplex(operandResult.value);

    let result: ComplexNumber;

    switch (node.operator) {
      case '+':
        result = operand;
        break;
      case '-':
        result = { real: -operand.real, imaginary: -operand.imaginary };
        break;
      default:
        return {
          value: { real: 0, imaginary: 0 },
          isValid: false,
          error: `Unknown unary operator: ${node.operator}`
        };
    }

    // Return real number if result has zero imaginary part
    if (Math.abs(result.imaginary) < 1e-10) {
      return {
        value: result.real,
        isValid: true
      };
    }

    return {
      value: result,
      isValid: true
    };
  }

  private evaluateFunction(node: ASTNode, z?: ComplexNumber): EvaluationResult {
    const args: (ComplexNumber | number)[] = [];

    for (const arg of node.args!) {
      const result = this.evaluate(arg, z);
      if (!result.isValid) {
        return result;
      }
      args.push(result.value);
    }

    switch (node.value) {
      case 'Re': {
        if (args.length !== 1) throw new Error('Re expects 1 argument');
        return {
          value: (args[0] as ComplexNumber).real,
          isValid: true
        };
      }

      case 'Im': {
        if (args.length !== 1) throw new Error('Im expects 1 argument');
        return {
          value: (args[0] as ComplexNumber).imaginary,
          isValid: true
        };
      }

      case 'abs': {
        if (args.length !== 1) throw new Error('abs expects 1 argument');
        const modulus = complexModulus(args[0] as ComplexNumber);
        return {
          value: modulus,
          isValid: true
        };
      }

      case 'arg': {
        if (args.length !== 1) throw new Error('arg expects 1 argument');
        const zArg = args[0] as ComplexNumber;
        const argument = Math.atan2(zArg.imaginary, zArg.real);
        return {
          value: argument,
          isValid: true
        };
      }

      case 'conj': {
        if (args.length !== 1) throw new Error('conj expects 1 argument');
        return {
          value: conjComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      case 'exp': {
        if (args.length !== 1) throw new Error('exp expects 1 argument');
        return {
          value: expComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      case 'log': {
        if (args.length !== 1) throw new Error('log expects 1 argument');
        return {
          value: logComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      case 'sqrt': {
        if (args.length !== 1) throw new Error('sqrt expects 1 argument');
        return {
          value: sqrtComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      case 'sin': {
        if (args.length !== 1) throw new Error('sin expects 1 argument');
        return {
          value: sinComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      case 'cos': {
        if (args.length !== 1) throw new Error('cos expects 1 argument');
        return {
          value: cosComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      case 'tan': {
        if (args.length !== 1) throw new Error('tan expects 1 argument');
        return {
          value: tanComplex(args[0] as ComplexNumber),
          isValid: true
        };
      }

      default:
        return {
          value: { real: 0, imaginary: 0 },
          isValid: false,
          error: `Unknown function: ${node.value}`
        };
    }
  }

  
  
  private evaluateComparison(left: EvaluationResult, right: EvaluationResult, operator: string): EvaluationResult {
    let result: boolean;

    // Convert both sides to numbers for comparison
    const leftNum = this.toNumber(left.value);
    const rightNum = this.toNumber(right.value);

    switch (operator) {
      case '=':
      case '==':
        result = leftNum === rightNum;
        break;
      case '!=':
        result = leftNum !== rightNum;
        break;
      case '<':
        result = leftNum < rightNum;
        break;
      case '>':
        result = leftNum > rightNum;
        break;
      case '<=':
        result = leftNum <= rightNum;
        break;
      case '>=':
        result = leftNum >= rightNum;
        break;
      default:
        return {
          value: 0 as ComplexOrNumber,
          isValid: false,
          error: `Unknown comparison operator: ${operator}`
        };
    }

    return {
      value: result as unknown as ComplexOrNumber,
      isValid: true
    };
  }

  private toComplex(value: ComplexNumber | number): ComplexNumber {
    if (typeof value === 'number') {
      return { real: value, imaginary: 0 };
    }
    return value;
  }

  private toNumber(value: ComplexNumber | number): number {
    if (typeof value === 'number') {
      return value;
    }
    // For complex numbers, use the modulus for comparison
    return complexModulus(value);
  }

  // Public method to evaluate expression with complex variable z
  evaluateExpression(node: ASTNode, z: ComplexNumber): EvaluationResult {
    return this.evaluate(node, z);
  }
}
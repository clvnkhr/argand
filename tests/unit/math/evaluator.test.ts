import { ExpressionParser } from '../../../src/math/parser';
import { ExpressionEvaluator } from '../../../src/math/evaluator';
import { createComplex, expectComplexEqual } from '../../setup';

describe('ExpressionEvaluator', () => {
  let parser: ExpressionParser;
  let evaluator: ExpressionEvaluator;

  beforeEach(() => {
    parser = new ExpressionParser();
    evaluator = new ExpressionEvaluator();
  });

  describe('Basic Arithmetic', () => {
    test('should evaluate numbers', () => {
      const result = parser.parseExpressionString('42');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(42);
    });

    test('should evaluate addition', () => {
      const result = parser.parseExpressionString('2 + 3');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(5);
    });

    test('should evaluate multiplication', () => {
      const result = parser.parseExpressionString('3 * 4');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(12);
    });

    test('should evaluate division', () => {
      const result = parser.parseExpressionString('8 / 2');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(4);
    });

    test('should handle division by zero', () => {
      const result = parser.parseExpressionString('1 / 0');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(false);
      expect(evaluation.error).toContain('Division by zero');
    });
  });

  describe('Complex Number Arithmetic', () => {
    test('should evaluate complex variable z', () => {
      const result = parser.parseExpressionString('z');
      expect(result.error).toBeUndefined();

      const z = createComplex(2, 3);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, z);
    });

    test('should evaluate complex addition', () => {
      const result = parser.parseExpressionString('z + (1 + i)');
      expect(result.error).toBeUndefined();

      const z = createComplex(2, 3);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(3, 4));
    });

    test('should evaluate complex multiplication', () => {
      const result = parser.parseExpressionString('z * (1 + i)');
      expect(result.error).toBeUndefined();

      const z = createComplex(1, 1);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(0, 2));
    });

    test('should evaluate complex powers', () => {
      const result = parser.parseExpressionString('z^2');
      expect(result.error).toBeUndefined();

      const z = createComplex(1, 1);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(0, 2));
    });

    test('should evaluate complex conjugate', () => {
      const result = parser.parseExpressionString('conj(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(2, 3);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(2, -3));
    });
  });

  describe('Complex Functions', () => {
    test('should evaluate modulus function', () => {
      const result = parser.parseExpressionString('abs(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(3, 4); // |z| = 5
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(5);
    });

    test('should evaluate real part', () => {
      const result = parser.parseExpressionString('Re(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(2, 3);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(2);
    });

    test('should evaluate imaginary part', () => {
      const result = parser.parseExpressionString('Im(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(2, 3);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(3);
    });

    test('should evaluate argument', () => {
      const result = parser.parseExpressionString('arg(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(1, 1); // arg = π/4
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(Math.abs((evaluation.value as number) - Math.PI / 4)).toBeLessThan(1e-10);
    });

    test('should evaluate exponential function', () => {
      const result = parser.parseExpressionString('exp(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(0, Math.PI); // e^(iπ) = -1
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      const value = evaluation.value as ComplexNumber;
      expectComplexEqual(value, createComplex(-1, 0), 1e-10);
    });

    test('should evaluate logarithm function', () => {
      const result = parser.parseExpressionString('log(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(Math.E, 0); // ln(e) = 1
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      const value = evaluation.value as ComplexNumber;
      expectComplexEqual(value, createComplex(1, 0), 1e-10);
    });

    test('should evaluate square root function', () => {
      const result = parser.parseExpressionString('sqrt(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(4, 0); // sqrt(4) = 2
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      const value = evaluation.value as ComplexNumber;
      expectComplexEqual(value, createComplex(2, 0), 1e-10);
    });
  });

  describe('Trigonometric Functions', () => {
    test('should evaluate sine function', () => {
      const result = parser.parseExpressionString('sin(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(0, 0); // sin(0) = 0
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(0, 0), 1e-10);
    });

    test('should evaluate cosine function', () => {
      const result = parser.parseExpressionString('cos(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(0, 0); // cos(0) = 1
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(1, 0), 1e-10);
    });

    test('should evaluate tangent function', () => {
      const result = parser.parseExpressionString('tan(z)');
      expect(result.error).toBeUndefined();

      const z = createComplex(0, 0); // tan(0) = 0
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(0, 0), 1e-10);
    });
  });

  describe('Modulus Operations', () => {
    test('should evaluate simple modulus', () => {
      const result = parser.parseExpressionString('|z|');
      expect(result.error).toBeUndefined();

      const z = createComplex(3, 4); // |z| = 5
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(5);
    });

    test('should evaluate nested modulus', () => {
      const result = parser.parseExpressionString('|z^2 + 1|');
      expect(result.error).toBeUndefined();

      const z = createComplex(1, 0); // |1^2 + 1| = |2| = 2
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(2);
    });
  });

  describe('Comparisons', () => {
    test('should evaluate equality comparisons', () => {
      const result = parser.parseExpressionString('2 == 2');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(true);
    });

    test('should evaluate inequality comparisons', () => {
      const result = parser.parseExpressionString('2 < 3');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(true);
    });

    test('should evaluate complex comparisons using modulus', () => {
      const result = parser.parseExpressionString('|z| > 5');
      expect(result.error).toBeUndefined();

      const z = createComplex(3, 4); // |z| = 5, so 5 > 5 is false
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(false);

      const z2 = createComplex(6, 0); // |z2| = 6, so 6 > 5 is true
      const evaluation2 = evaluator.evaluateExpression(result.ast, z2);
      expect(evaluation2.isValid).toBe(true);
      expect(evaluation2.value).toBe(true);
    });
  });

  describe('Variable Substitution', () => {
    test('should substitute variables in expressions', () => {
      evaluator.setVariable('A', createComplex(2, 3));
      const result = parser.parseExpressionString('A + z');
      expect(result.error).toBeUndefined();

      const z = createComplex(1, 1);
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(3, 4));
    });

    test('should handle multiple variables', () => {
      evaluator.setVariable('A', createComplex(1, 0));
      evaluator.setVariable('B', createComplex(0, 1));
      const result = parser.parseExpressionString('A + B');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      expectComplexEqual(evaluation.value as ComplexNumber, createComplex(1, 1));
    });

    test('should return error for undefined variables', () => {
      const result = parser.parseExpressionString('unknown_var');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(false);
      expect(evaluation.error).toContain('Unknown variable');
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid expressions gracefully', () => {
      const result = parser.parseExpressionString('1/0');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(false);
      expect(evaluation.error).toBeDefined();
    });

    test('should handle NaN and Infinity', () => {
      const result = parser.parseExpressionString('sqrt(-1)');
      expect(result.error).toBeUndefined();

      const evaluation = evaluator.evaluateExpression(result.ast, createComplex(0, 0));
      expect(evaluation.isValid).toBe(true);
      // Should return a complex result for sqrt(-1)
      const value = evaluation.value as ComplexNumber;
      expect(typeof value.real).toBe('number');
      expect(typeof value.imaginary).toBe('number');
    });
  });

  describe('Complex Polynomials', () => {
    test('should evaluate z^2 + 1', () => {
      const result = parser.parseExpressionString('z^2 + 1');
      expect(result.error).toBeUndefined();

      const z = createComplex(2, 0); // 2^2 + 1 = 5
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);

      // Handle both real numbers and complex numbers with zero imaginary part
      if (typeof evaluation.value === 'number') {
        expect(evaluation.value).toBe(5);
      } else {
        const value = evaluation.value as ComplexNumber;
        expectComplexEqual(value, createComplex(5, 0), 1e-10);
      }
    });

    test('should evaluate |z^2 + 1|', () => {
      const result = parser.parseExpressionString('|z^2 + 1|');
      expect(result.error).toBeUndefined();

      const z = createComplex(0, 1); // |i^2 + 1| = |0| = 0
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(0);
    });

    test('should evaluate complex polynomial inequalities', () => {
      const result = parser.parseExpressionString('|z^2 + 1| <= 1');
      expect(result.error).toBeUndefined();

      const z = createComplex(0, 1); // |i^2 + 1| = 0 <= 1 is true
      const evaluation = evaluator.evaluateExpression(result.ast, z);
      expect(evaluation.isValid).toBe(true);
      expect(evaluation.value).toBe(true);

      const z2 = createComplex(2, 0); // |2^2 + 1| = 5 <= 1 is false
      const evaluation2 = evaluator.evaluateExpression(result.ast, z2);
      expect(evaluation2.isValid).toBe(true);
      expect(evaluation2.value).toBe(false);
    });
  });
});
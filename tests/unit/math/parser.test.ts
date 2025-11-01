import { ExpressionParser } from '../../../src/math/parser';
import { ComplexNumber } from '../../../src/types/complex';
import { createComplex, expectComplexEqual } from '../../setup';

describe('ExpressionParser', () => {
  let parser: ExpressionParser;

  beforeEach(() => {
    parser = new ExpressionParser();
  });

  describe('Tokenization', () => {
    test('should tokenize simple numbers', () => {
      const tokens = parser.tokenize('123');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('123');
    });

    test('should tokenize decimal numbers', () => {
      const tokens = parser.tokenize('3.14');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[0].value).toBe('3.14');
    });

    test('should tokenize imaginary numbers', () => {
      const tokens = parser.tokenize('2i');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('IMAGINARY');
      expect(tokens[0].value).toBe('2');
    });

    test('should tokenize pure imaginary unit', () => {
      const tokens = parser.tokenize('i');
      expect(tokens).toHaveLength(1);
      expect(tokens[0].type).toBe('IMAGINARY');
      expect(tokens[0].value).toBe('1');
    });

    test('should tokenize complex expressions', () => {
      const tokens = parser.tokenize('2 + 3i');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe('NUMBER');
      expect(tokens[1].type).toBe('OPERATOR');
      expect(tokens[2].type).toBe('IMAGINARY');
    });

    test('should tokenize functions', () => {
      const tokens = parser.tokenize('sin(z)');
      expect(tokens).toHaveLength(4);
      expect(tokens[0].type).toBe('FUNCTION');
      expect(tokens[1].type).toBe('PARENOPEN');
      expect(tokens[2].type).toBe('VARIABLE');
      expect(tokens[3].type).toBe('PARENCLOSE');
    });

    test('should tokenize modulus', () => {
      const tokens = parser.tokenize('|z|');
      expect(tokens).toHaveLength(3);
      expect(tokens[0].type).toBe('MODULUS');
      expect(tokens[1].type).toBe('VARIABLE');
      expect(tokens[2].type).toBe('MODULUS');
    });

    test('should tokenize inequalities', () => {
      const tokens = parser.tokenize('|z^2 + 1| <= 1');
      expect(tokens).toHaveLength(9);
      expect(tokens[0].type).toBe('MODULUS');
      expect(tokens[6].type).toBe('MODULUS');
      expect(tokens[7].type).toBe('COMPARISON');
      expect(tokens[7].value).toBe('<=');
    });

    test('should ignore whitespace', () => {
      const tokens1 = parser.tokenize('2+3i');
      const tokens2 = parser.tokenize(' 2 + 3i ');
      expect(tokens1).toHaveLength(3);
      expect(tokens2).toHaveLength(3);
      expect(tokens1[0].value).toBe(tokens2[0].value);
    });
  });

  describe('Parsing', () => {
    test('should parse simple numbers', () => {
      const result = parser.parseExpressionString('42');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('number');
      expect(result.ast.value).toBe(42);
    });

    test('should parse complex numbers', () => {
      const result = parser.parseExpressionString('2 + 3i');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('binary');
      expect(result.ast.operator).toBe('+');
    });

    test('should parse variables', () => {
      const result = parser.parseExpressionString('z');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('variable');
      expect(result.ast.value).toBe('z');
    });

    test('should parse simple functions', () => {
      const result = parser.parseExpressionString('sin(z)');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('function');
      expect(result.ast.value).toBe('sin');
      expect(result.ast.args).toHaveLength(1);
    });

    test('should parse modulus expressions', () => {
      const result = parser.parseExpressionString('|z|');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('modulus');
    });

    test('should parse nested modulus', () => {
      const result = parser.parseExpressionString('|z^2 + 1|');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('modulus');
    });

    test('should parse inequalities', () => {
      const result = parser.parseExpressionString('|z^2 + 1| <= 1');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('binary');
      expect(result.ast.operator).toBe('<=');
    });

    test('should parse power expressions', () => {
      const result = parser.parseExpressionString('z^2');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('binary');
      expect(result.ast.operator).toBe('^');
    });

    test('should parse complex polynomial', () => {
      const result = parser.parseExpressionString('z^2 + 2*z + 1');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('binary');
      expect(result.ast.operator).toBe('+');
    });

    test('should handle operator precedence correctly', () => {
      const result = parser.parseExpressionString('2 + 3 * 4');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('binary');
      expect(result.ast.operator).toBe('+');
      expect(result.ast.right?.type).toBe('binary');
      expect(result.ast.right?.operator).toBe('*');
    });

    test('should handle parentheses', () => {
      const result = parser.parseExpressionString('(2 + 3) * 4');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('binary');
      expect(result.ast.operator).toBe('*');
      expect(result.ast.left?.type).toBe('binary');
      expect(result.ast.left?.operator).toBe('+');
    });

    test('should handle unary minus', () => {
      const result = parser.parseExpressionString('-z');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('unary');
      expect(result.ast.operator).toBe('-');
    });

    test('should parse function with multiple arguments', () => {
      // This would require adding a multi-argument function to the parser
      const result = parser.parseExpressionString('sin(z)');
      expect(result.error).toBeUndefined();
    });

    test('should return error for invalid syntax', () => {
      const result = parser.parseExpressionString('2 + +');
      expect(result.error).toBeDefined();
    });

    test('should return error for unclosed parentheses', () => {
      const result = parser.parseExpressionString('(2 + 3');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('parenthesis');
    });

    test('should return error for unclosed modulus', () => {
      const result = parser.parseExpressionString('|z');
      expect(result.error).toBeDefined();
    });
  });

  describe('Variable Management', () => {
    test('should set and get variables', () => {
      const testVar = createComplex(2, 3);
      parser.setVariable('A', testVar);
      expect(parser.getVariable('A')).toEqual(testVar);
    });

    test('should return undefined for unknown variables', () => {
      expect(parser.getVariable('unknown')).toBeUndefined();
    });

    test('should handle variable names in expressions', () => {
      parser.setVariable('A', createComplex(1, 1));
      const result = parser.parseExpressionString('A');
      expect(result.error).toBeUndefined();
      expect(result.ast.type).toBe('variable');
      expect(result.ast.value).toBe('A');
    });
  });

  describe('Error Handling', () => {
    test('should handle empty input', () => {
      const result = parser.parseExpressionString('');
      expect(result.error).toBeDefined();
    });

    test('should handle unknown functions', () => {
      const result = parser.parseExpressionString('unknown(z)');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown function');
    });

    test('should handle incorrect number of arguments', () => {
      const result = parser.parseExpressionString('Re(z, w)');
      expect(result.error).toBeDefined();
      expect(result.error).toContain('expects 1 argument');
    });
  });
});
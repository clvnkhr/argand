import {
  complexToCartesian,
  cartesianToComplex,
  complexModulus,
  complexArgument,
  addComplex,
  multiplyComplex,
  scaleComplex
} from '../../../src/utils/complex';
import { createComplex, expectComplexEqual } from '../../setup';

describe('Complex Number Utilities', () => {
  describe('complexToCartesian', () => {
    test('should convert complex number to cartesian coordinates', () => {
      const z = createComplex(3, 4);
      const result = complexToCartesian(z);
      expect(result).toEqual({ x: 3, y: 4 });
    });

    test('should handle zero', () => {
      const z = createComplex(0, 0);
      const result = complexToCartesian(z);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    test('should handle negative numbers', () => {
      const z = createComplex(-2, -5);
      const result = complexToCartesian(z);
      expect(result).toEqual({ x: -2, y: -5 });
    });
  });

  describe('cartesianToComplex', () => {
    test('should convert cartesian coordinates to complex number', () => {
      const result = cartesianToComplex(3, 4);
      expectComplexEqual(result, createComplex(3, 4));
    });

    test('should handle zero', () => {
      const result = cartesianToComplex(0, 0);
      expectComplexEqual(result, createComplex(0, 0));
    });

    test('should handle negative coordinates', () => {
      const result = cartesianToComplex(-2, -5);
      expectComplexEqual(result, createComplex(-2, -5));
    });

    test('should handle floating point numbers', () => {
      const result = cartesianToComplex(1.5, 2.7);
      expectComplexEqual(result, createComplex(1.5, 2.7));
    });
  });

  describe('complexModulus', () => {
    test('should calculate modulus correctly', () => {
      expect(complexModulus(createComplex(3, 4))).toBe(5);
      expect(complexModulus(createComplex(5, 12))).toBe(13);
      expect(complexModulus(createComplex(1, 1))).toBeCloseTo(Math.sqrt(2), 10);
    });

    test('should handle zero', () => {
      expect(complexModulus(createComplex(0, 0))).toBe(0);
    });

    test('should handle pure real numbers', () => {
      expect(complexModulus(createComplex(5, 0))).toBe(5);
      expect(complexModulus(createComplex(-3, 0))).toBe(3);
    });

    test('should handle pure imaginary numbers', () => {
      expect(complexModulus(createComplex(0, 7))).toBe(7);
      expect(complexModulus(createComplex(0, -4))).toBe(4);
    });
  });

  describe('complexArgument', () => {
    test('should calculate argument correctly', () => {
      expect(complexArgument(createComplex(1, 0))).toBeCloseTo(0, 10);
      expect(complexArgument(createComplex(0, 1))).toBeCloseTo(Math.PI / 2, 10);
      expect(complexArgument(createComplex(-1, 0))).toBeCloseTo(Math.PI, 10);
      expect(complexArgument(createComplex(0, -1))).toBeCloseTo(-Math.PI / 2, 10);
      expect(complexArgument(createComplex(1, 1))).toBeCloseTo(Math.PI / 4, 10);
    });

    test('should handle zero', () => {
      expect(complexArgument(createComplex(0, 0))).toBe(0);
    });

    test('should handle negative coordinates', () => {
      expect(complexArgument(createComplex(-1, 1))).toBeCloseTo(3 * Math.PI / 4, 10);
      expect(complexArgument(createComplex(-1, -1))).toBeCloseTo(-3 * Math.PI / 4, 10);
    });
  });

  describe('addComplex', () => {
    test('should add complex numbers correctly', () => {
      const a = createComplex(2, 3);
      const b = createComplex(4, 5);
      const result = addComplex(a, b);
      expectComplexEqual(result, createComplex(6, 8));
    });

    test('should handle addition with zero', () => {
      const a = createComplex(2, 3);
      const zero = createComplex(0, 0);
      expectComplexEqual(addComplex(a, zero), a);
      expectComplexEqual(addComplex(zero, a), a);
    });

    test('should handle negative numbers', () => {
      const a = createComplex(5, 7);
      const b = createComplex(-2, -3);
      const result = addComplex(a, b);
      expectComplexEqual(result, createComplex(3, 4));
    });

    test('should be commutative', () => {
      const a = createComplex(2, 3);
      const b = createComplex(4, 5);
      expectComplexEqual(addComplex(a, b), addComplex(b, a));
    });
  });

  describe('multiplyComplex', () => {
    test('should multiply complex numbers correctly', () => {
      const a = createComplex(2, 3);
      const b = createComplex(4, 5);
      const result = multiplyComplex(a, b);
      expectComplexEqual(result, createComplex(-7, 22));
    });

    test('should handle multiplication by zero', () => {
      const a = createComplex(2, 3);
      const zero = createComplex(0, 0);
      expectComplexEqual(multiplyComplex(a, zero), zero);
      expectComplexEqual(multiplyComplex(zero, a), zero);
    });

    test('should handle multiplication by one', () => {
      const a = createComplex(2, 3);
      const one = createComplex(1, 0);
      expectComplexEqual(multiplyComplex(a, one), a);
      expectComplexEqual(multiplyComplex(one, a), a);
    });

    test('should handle multiplication by i', () => {
      const a = createComplex(2, 3);
      const i = createComplex(0, 1);
      const result = multiplyComplex(a, i);
      expectComplexEqual(result, createComplex(-3, 2));
    });

    test('should handle pure imaginary numbers', () => {
      const a = createComplex(0, 2);
      const b = createComplex(0, 3);
      const result = multiplyComplex(a, b);
      expectComplexEqual(result, createComplex(-6, 0));
    });

    test('should be commutative', () => {
      const a = createComplex(2, 3);
      const b = createComplex(4, 5);
      expectComplexEqual(multiplyComplex(a, b), multiplyComplex(b, a));
    });
  });

  describe('scaleComplex', () => {
    test('should scale complex numbers correctly', () => {
      const z = createComplex(2, 3);
      const result = scaleComplex(z, 2);
      expectComplexEqual(result, createComplex(4, 6));
    });

    test('should handle scaling by zero', () => {
      const z = createComplex(2, 3);
      const result = scaleComplex(z, 0);
      expectComplexEqual(result, createComplex(0, 0));
    });

    test('should handle scaling by one', () => {
      const z = createComplex(2, 3);
      const result = scaleComplex(z, 1);
      expectComplexEqual(result, z);
    });

    test('should handle negative scaling', () => {
      const z = createComplex(2, 3);
      const result = scaleComplex(z, -1);
      expectComplexEqual(result, createComplex(-2, -3));
    });

    test('should handle fractional scaling', () => {
      const z = createComplex(4, 6);
      const result = scaleComplex(z, 0.5);
      expectComplexEqual(result, createComplex(2, 3));
    });

    test('should handle scaling by pi', () => {
      const z = createComplex(1, 1);
      const result = scaleComplex(z, Math.PI);
      expectComplexEqual(result, createComplex(Math.PI, Math.PI));
    });
  });

  describe('Integration Tests', () => {
    test('should convert complex to cartesian and back', () => {
      const original = createComplex(3.14, 2.71);
      const cartesian = complexToCartesian(original);
      const converted = cartesianToComplex(cartesian.x, cartesian.y);
      expectComplexEqual(original, converted);
    });

    test('should maintain properties through operations', () => {
      const z = createComplex(3, 4);

      // (z * conjugate(z)) should be |z|^2 (a real number)
      const conjugate = { real: z.real, imaginary: -z.imaginary };
      const product = multiplyComplex(z, conjugate);
      expectComplexEqual(product, createComplex(complexModulus(z) ** 2, 0));

      // Multiplying by i should rotate by 90 degrees
      const i = createComplex(0, 1);
      const rotated = multiplyComplex(z, i);
      expectComplexEqual(rotated, createComplex(-4, 3));
    });

    test('should handle complex number arithmetic consistency', () => {
      const a = createComplex(1, 2);
      const b = createComplex(3, 4);

      // (a + b) * c should equal a * c + b * c
      const c = createComplex(2, 1);
      const sum = addComplex(a, b);
      const leftSide = multiplyComplex(sum, c);

      const aTimesC = multiplyComplex(a, c);
      const bTimesC = multiplyComplex(b, c);
      const rightSide = addComplex(aTimesC, bTimesC);

      expectComplexEqual(leftSide, rightSide, 1e-10);
    });
  });
});
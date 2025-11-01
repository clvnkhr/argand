import { useLatexConverter } from '../../../src/components/MathJaxRenderer';

describe('MathJaxRenderer', () => {
  describe('useLatexConverter', () => {
    test('should convert modulus expressions to LaTeX', () => {
      const { convertToLatex } = useLatexConverter();

      expect(convertToLatex('|z-1|=3')).toBe('\\left|z-1\\right| = 3');
      expect(convertToLatex('|z| = 2')).toBe('\\left|z\\right| = 2');
      expect(convertToLatex('|z - (2 + 3i)| = 5')).toBe('\\left|z - (2 + 3i)\\right| = 5');
    });

    test('should convert complex number expressions', () => {
      const { convertToLatex } = useLatexConverter();

      expect(convertToLatex('z = 2 + 3i')).toBe('z = 2 + 3i');
      expect(convertToLatex('Re(z) = 1')).toBe('\\operatorname{Re}(z) = 1');
      expect(convertToLatex('Im(z) = 2')).toBe('\\operatorname{Im}(z) = 2');
    });

    test('should handle inequalities', () => {
      const { convertToLatex } = useLatexConverter();

      expect(convertToLatex('|z-1| <= 3')).toBe('\\left|z-1\\right| \\leq 3');
      expect(convertToLatex('|z-1| >= 3')).toBe('\\left|z-1\\right| \\geq 3');
      expect(convertToLatex('|z-1| != 3')).toBe('\\left|z-1\\right| \\neq 3');
    });

    test('should handle functions', () => {
      const { convertToLatex } = useLatexConverter();

      expect(convertToLatex('arg(z) = π/4')).toBe('\\arg(z) = π/4');
      expect(convertToLatex('sqrt(z)')).toBe('\\sqrt{z)');
      expect(convertToLatex('sin(z)')).toBe('\\sin(z)');
      expect(convertToLatex('cos(z)')).toBe('\\cos(z)');
    });

    test('should handle complex modulus expressions', () => {
      const { convertToLatex } = useLatexConverter();

      expect(convertToLatex('|z^2 + 1| = 2')).toBe('\\left|z^2 + 1\\right| = 2');
      expect(convertToLatex('|z - (1 + i)| < 1')).toBe('\\left|z - (1 + i)\\right| < 1');
      expect(convertToLatex('|z| <= 5')).toBe('\\left|z\\right| \\leq 5');
    });

    test('should handle multiple modulus operations', () => {
      const { convertToLatex } = useLatexConverter();

      // Test multiple modulus in the same expression
      expect(convertToLatex('|z + 1| + |z - 1| = 4')).toBe('\\left|z + 1\\right| + \\left|z - 1\\right| = 4');
      // Note: Nested modulus like ||z|| is not commonly used and may not render perfectly
    });

    test('should handle powers and operations inside modulus', () => {
      const { convertToLatex } = useLatexConverter();

      expect(convertToLatex('|z^2 + 2z + 1| = 4')).toBe('\\left|z^2 + 2z + 1\\right| = 4');
      expect(convertToLatex('|z + 1| + |z - 1| = 4')).toBe('\\left|z + 1\\right| + \\left|z - 1\\right| = 4');
    });
  });
});
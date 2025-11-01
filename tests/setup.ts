import { expect, describe, test, it } from 'bun:test';

// Global test setup
globalThis.describe = describe;
globalThis.test = test;
globalThis.it = it;

// Mock DOM for testing
if (typeof window === 'undefined') {
  global.window = {} as Window;
  global.document = {} as Document;
  global.SVGElement = class {} as any;
  global.HTMLElement = class {} as any;
}

// Complex number test utilities
export const createComplex = (real: number, imaginary: number) => ({ real, imaginary });

export const expectComplexEqual = (actual: { real: number; imaginary: number }, expected: { real: number; imaginary: number }, tolerance = 1e-10) => {
  expect(Math.abs(actual.real - expected.real)).toBeLessThan(tolerance);
  expect(Math.abs(actual.imaginary - expected.imaginary)).toBeLessThan(tolerance);
};

// Mock MathJax for testing
global.MathJax = {
  texReset: () => {},
  typesetPromise: async () => {},
  startup: {
    document: {
      ready: () => {}
    }
  }
};
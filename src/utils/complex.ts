import { ComplexNumber } from '../types/complex';

export const complexToCartesian = (z: ComplexNumber): { x: number; y: number } => {
  return { x: z.real, y: z.imaginary };
};

export const cartesianToComplex = (x: number, y: number): ComplexNumber => {
  return { real: x, imaginary: y };
};

export const complexModulus = (z: ComplexNumber): number => {
  return Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
};

export const complexArgument = (z: ComplexNumber): number => {
  return Math.atan2(z.imaginary, z.real);
};

export const addComplex = (a: ComplexNumber, b: ComplexNumber): ComplexNumber => {
  return { real: a.real + b.real, imaginary: a.imaginary + b.imaginary };
};

export const multiplyComplex = (a: ComplexNumber, b: ComplexNumber): ComplexNumber => {
  return {
    real: a.real * b.real - a.imaginary * b.imaginary,
    imaginary: a.real * b.imaginary + a.imaginary * b.real
  };
};

export const scaleComplex = (z: ComplexNumber, scale: number): ComplexNumber => {
  return { real: z.real * scale, imaginary: z.imaginary * scale };
};
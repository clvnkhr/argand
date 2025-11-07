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

export const subtractComplex = (a: ComplexNumber, b: ComplexNumber): ComplexNumber => {
  return { real: a.real - b.real, imaginary: a.imaginary - b.imaginary };
};

export const divideComplex = (a: ComplexNumber, b: ComplexNumber): ComplexNumber => {
  const denominator = b.real * b.real + b.imaginary * b.imaginary;
  if (denominator === 0) {
    throw new Error('Division by zero');
  }
  return {
    real: (a.real * b.real + a.imaginary * b.imaginary) / denominator,
    imaginary: (a.imaginary * b.real - a.real * b.imaginary) / denominator
  };
};

export const expComplex = (z: ComplexNumber): ComplexNumber => {
  const expReal = Math.exp(z.real);
  return {
    real: expReal * Math.cos(z.imaginary),
    imaginary: expReal * Math.sin(z.imaginary)
  };
};

export const logComplex = (z: ComplexNumber): ComplexNumber => {
  const r = Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
  const theta = Math.atan2(z.imaginary, z.real);
  return {
    real: Math.log(r),
    imaginary: theta
  };
};

export const sqrtComplex = (z: ComplexNumber): ComplexNumber => {
  const r = Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
  const theta = Math.atan2(z.imaginary, z.real);
  const sqrtR = Math.sqrt(r);
  return {
    real: sqrtR * Math.cos(theta / 2),
    imaginary: sqrtR * Math.sin(theta / 2)
  };
};

export const sinComplex = (z: ComplexNumber): ComplexNumber => {
  return {
    real: Math.sin(z.real) * Math.cosh(z.imaginary),
    imaginary: Math.cos(z.real) * Math.sinh(z.imaginary)
  };
};

export const cosComplex = (z: ComplexNumber): ComplexNumber => {
  return {
    real: Math.cos(z.real) * Math.cosh(z.imaginary),
    imaginary: -Math.sin(z.real) * Math.sinh(z.imaginary)
  };
};

export const tanComplex = (z: ComplexNumber): ComplexNumber => {
  const sin = sinComplex(z);
  const cos = cosComplex(z);
  return divideComplex(sin, cos);
};

export const conjComplex = (z: ComplexNumber): ComplexNumber => {
  return { real: z.real, imaginary: -z.imaginary };
};
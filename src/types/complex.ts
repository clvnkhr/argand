export interface ComplexNumber {
  real: number;
  imaginary: number;
}

export interface Point {
  x: number;
  y: number;
  color?: string;
  label?: string;
  name?: string; // For named points like A, B, etc.
  lineThickness?: number; // Line thickness for rendering
}

export interface Curve {
  points: Point[];
  color?: string;
  label?: string;
  name?: string;
  type?: 'line' | 'curve' | 'path';
  lineThickness?: number; // Line thickness for rendering
}

export interface Inequality {
  type: 'circle' | 'half-plane' | 'annulus' | 'custom' | 'region';
  center?: ComplexNumber;
  radius?: number;
  boundary?: 'solid' | 'dashed';
  color?: string;
  label?: string;
  name?: string;
  lineThickness?: number; // Line thickness for boundary rendering
  // For half-planes
  lineStart?: ComplexNumber;
  lineEnd?: ComplexNumber;
  // For annulus
  innerRadius?: number;
  outerRadius?: number;
  // For custom regions from expressions
  expression?: string;
  evaluationData?: Float32Array; // Precomputed grid values
  resolution?: number;
}

// Enhanced plot element that can come from expressions
export interface ExpressionElement {
  type: 'expression';
  expression: string;
  originalExpression: string;
  color?: string;
  label?: string;
  name?: string;
  lineThickness?: number; // Line thickness for rendering
  evaluationData?: Float32Array;
  points?: Point[];
  boundary?: Point[];
}

export type PlotElement = Point | Curve | Inequality | ExpressionElement;

// Complex plane utilities
export interface ComplexPlane {
  width: number;
  height: number;
  range: number;
  centerX: number;
  centerY: number;
  scale: number;
}

// Plotting configuration
export interface PlotConfig {
  width: number;
  height: number;
  range: number;
  resolution: number; // Grid resolution for inequality evaluation
  adaptiveSampling: boolean;
  showGrid: boolean;
  showAxes: boolean;
  backgroundColor: string;
  gridColor: string;
  axisColor: string;
  tickSize: number; // Size of axis ticks
  // Viewport information for dynamic plotting
  viewportOffsetX?: number;
  viewportOffsetY?: number;
  viewportZoom?: number;
}
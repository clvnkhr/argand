import { ComplexNumber } from './complex';

export interface PointExpression {
  type: 'point';
  expression: string; // "2", "1+i", "A=-i"
  originalExpression?: string;
  name?: string;      // "A" for named points
  color?: string;
  label?: string;
  visible?: boolean;  // Toggle visibility in the plot
  lineThickness?: number; // Line thickness for plotting
}

export interface EqualityExpression {
  type: 'equality';
  expression: string; // "z=2", "|z|^2 + |z-2| = 1"
  originalExpression?: string;
  color?: string;
  label?: string;
  visible?: boolean;  // Toggle visibility in the plot
  lineThickness?: number; // Line thickness for plotting
}

export interface InequalityExpression {
  type: 'inequality';
  expression: string; // "|z^2 + 1| <= 1", "Re(z) > 0"
  originalExpression?: string;
  color?: string;
  label?: string;
  visible?: boolean;  // Toggle visibility in the plot
  lineThickness?: number; // Line thickness for plotting
}

export interface NamedVariable {
  name: string;
  value: ComplexNumber;
  expression: string; // Original expression that defined it
}

export type PlotExpression = PointExpression | EqualityExpression | InequalityExpression;

// Token types for expression parsing
export type TokenType =
  | 'NUMBER'
  | 'VARIABLE'
  | 'OPERATOR' // +, -, *, /
  | 'POWER'    // ^
  | 'MODULUS'  // | |
  | 'PARENOPEN' // (
  | 'PARENCLOSE' // )
  | 'EQUALS'   // =
  | 'COMPARISON' // <, >, <=, >=
  | 'IMAGINARY' // i
  | 'FUNCTION' // function name
  | 'COMMA'
  | 'SEMICOLON'
  | 'UNKNOWN';

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export interface ASTNode {
  type: 'number' | 'variable' | 'binary' | 'unary' | 'function' | 'modulus' | 'imaginary';
  value?: string | number;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
  operand?: ASTNode;
  args?: ASTNode[];
}

// Parsing context
export interface ParseContext {
  variables: Map<string, ComplexNumber>;
  currentPosition: number;
  tokens: Token[];
}

// Evaluation result
export interface EvaluationResult {
  value: ComplexNumber | number;
  isValid: boolean;
  error?: string;
}

// Plotting region for inequalities
export interface PlotRegion {
  points: { x: number; y: number }[];
  boundary: { x: number; y: number }[];
  type: 'filled' | 'boundary' | 'both';
}

// Mathematical function definitions
export interface MathFunction {
  name: string;
  argCount: number;
  evaluate: (args: (ComplexNumber | number)[]) => ComplexNumber | number;
  description?: string;
}

// Expression template
export interface ExpressionTemplate {
  name: string;
  description: string;
  template: string;
  category: 'point' | 'equality' | 'inequality' | 'function';
  examples?: string[];
}
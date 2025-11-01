import { ASTNode } from '../types/expressions';
import { ComplexNumber, PlotConfig, Point } from '../types/complex';
import { ExpressionEvaluator } from './evaluator';

export interface PlotRegion {
  points: Point[];
  boundary: Point[] | Point[][]; // Single boundary or array of boundary curves
  type: 'filled' | 'boundary' | 'both';
  value?: number;
  expression: string;
  color?: string;
}

export type { PlotConfig };

export interface PlottingResult {
  regions: PlotRegion[];
  error?: string;
  metadata: {
    resolution: number;
    boundingBox: { min: Point; max: Point };
    computationTime: number;
  };
}

export class HybridPlotter {
  private evaluator: ExpressionEvaluator;
  private config: PlotConfig;

  constructor(config: PlotConfig) {
    this.evaluator = new ExpressionEvaluator();
    this.config = config;
  }

  updateConfig(config: Partial<PlotConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Main plotting function for expressions
  plotExpression(ast: ASTNode, expression: string): PlottingResult {
    const startTime = performance.now();

    try {
      // Analyze expression type to choose best plotting method
      const expressionType = this.analyzeExpression(ast);

      let regions: PlotRegion[] = [];

      switch (expressionType) {
        case 'equality':
          regions = this.plotEquality(ast, expression);
          break;
        case 'inequality':
          regions = this.plotInequality(ast, expression);
          break;
        case 'point':
          regions = this.plotPoint(ast, expression);
          break;
        case 'complex':
          regions = this.plotComplexExpression(ast, expression);
          break;
        default:
          regions = this.plotGeneric(ast, expression);
      }

      const endTime = performance.now();
      const boundingBox = this.calculateBoundingBox(regions);

      return {
        regions,
        metadata: {
          resolution: this.config.resolution,
          boundingBox,
          computationTime: endTime - startTime
        }
      };
    } catch (error) {
      return {
        regions: [],
        error: error instanceof Error ? error.message : 'Plotting error',
        metadata: {
          resolution: this.config.resolution,
          boundingBox: { min: { x: -this.config.range, y: -this.config.range }, max: { x: this.config.range, y: this.config.range } },
          computationTime: performance.now() - startTime
        }
      };
    }
  }

  private analyzeExpression(ast: ASTNode): 'equality' | 'inequality' | 'point' | 'complex' | 'generic' {
    // Check for comparison operators
    const hasComparison = this.hasComparisonOperator(ast);
    const hasEquality = this.hasEqualityOperator(ast);

    if (hasEquality && !hasComparison) {
      return 'equality';
    } else if (hasComparison) {
      return 'inequality';
    } else if (this.isSimplePoint(ast)) {
      return 'point';
    } else {
      return 'complex';
    }
  }

  private hasComparisonOperator(node: ASTNode): boolean {
    if (node.type === 'binary' && ['<', '>', '<=', '>=', '!='].includes(node.operator!)) {
      return true;
    }
    if (node.left && this.hasComparisonOperator(node.left)) return true;
    if (node.right && this.hasComparisonOperator(node.right)) return true;
    if (node.operand && this.hasComparisonOperator(node.operand)) return true;
    if (node.args) {
      for (const arg of node.args) {
        if (this.hasComparisonOperator(arg)) return true;
      }
    }
    return false;
  }

  private hasEqualityOperator(node: ASTNode): boolean {
    if (node.type === 'binary' && ['=', '=='].includes(node.operator!)) {
      return true;
    }
    if (node.left && this.hasEqualityOperator(node.left)) return true;
    if (node.right && this.hasEqualityOperator(node.right)) return true;
    if (node.operand && this.hasEqualityOperator(node.operand)) return true;
    if (node.args) {
      for (const arg of node.args) {
        if (this.hasEqualityOperator(arg)) return true;
      }
    }
    return false;
  }

  private isSimplePoint(ast: ASTNode): boolean {
    // Check if this is just a complex number or variable
    return ast.type === 'number' || ast.type === 'variable';
  }

  private transformToZeroBased(ast: ASTNode): ASTNode {
    // If this is an equality (left = right), transform it to (left - right)
    if (ast.type === 'binary' && (ast.operator === '=' || ast.operator === '==')) {
      return {
        type: 'binary',
        operator: '-',
        left: ast.left!,
        right: ast.right!
      };
    }

    // If it's not an equality, return as-is (might already be zero-based)
    return ast;
  }

  private plotEquality(ast: ASTNode, expression: string): PlotRegion[] {
    const regions: PlotRegion[] = [];

    // Check if this is a simple linear modulus equality like |z| = |z-1|
    const analyticBoundary = this.tryAnalyticSolution(ast);
    if (analyticBoundary) {
      regions.push({
        points: [],
        boundary: analyticBoundary,
        type: 'boundary',
        expression
      });
      return regions;
    }

    // Transform equality to zero-based form for boundary tracing
    // For example: |z| = 1 becomes |z| - 1, then we look for where it equals 0
    const zeroBasedAst = this.transformToZeroBased(ast);

    // Try boundary tracing first for polynomial equalities
    const boundaryCurves = this.traceBoundary(zeroBasedAst);

    if (boundaryCurves.length > 0) {
      regions.push({
        points: [],
        boundary: boundaryCurves,
        type: 'boundary',
        expression
      });
    } else {
      // Fallback to contour detection with higher resolution
      const contourPoints = this.findContour(zeroBasedAst, 0);
      regions.push({
        points: [],
        boundary: contourPoints,
        type: 'boundary',
        expression
      });
    }

    return regions;
  }

  // Try to find analytical solutions for simple modulus equalities
  private tryAnalyticSolution(ast: ASTNode): Point[][] | null {
    // Check if this is of the form |z - a| = |z - b|
    if (this.isModulusEquality(ast)) {
      const points = this.extractComplexConstants(ast);
      if (points.length === 2) {
        // This is |z - a| = |z - b|, which represents the perpendicular bisector
        // of the line segment connecting a and b
        return this.generatePerpendicularBisector(points[0], points[1]);
      }
    }

    // Check if this is of the form |z - a| = r (circle)
    if (this.isModulusConstantEquality(ast)) {
      const result = this.extractModulusConstant(ast);
      if (result) {
        // This is |z - a| = r, which represents a circle
        return this.generateCircle(result.center, result.radius);
      }
    }

    // Check if this is of the form |z - a| = k|z - b| (Apollonian circle)
    if (this.isWeightedModulusEquality(ast)) {
      const result = this.extractWeightedModulusConstants(ast);
      if (result) {
        // This is |z - a| = k|z - b|, which represents an Apollonian circle
        // Note: when k = 1, this degenerates to a perpendicular bisector
        return this.generateApollonianCircle(result.point1, result.point2, result.ratio);
      }
    }

    // Check for simple linear equations like Im(z) = constant or Re(z) = constant
    if (this.isLinearEquality(ast)) {
      console.log('Linear equality detected:', JSON.stringify(ast, null, 2));
      const lineResult = this.extractLinearConstants(ast);
      if (lineResult) {
        console.log('Line result:', lineResult);
        const line = this.generateStraightLine(lineResult);
        console.log('Generated line points:', line[0].length, 'points');
        return line;
      } else {
        console.log('Failed to extract line constants');
      }
    } else {
      console.log('Not a linear equality, AST type:', ast.type, 'operator:', (ast as any).operator);
    }

    return null;
  }

  private isModulusEquality(ast: ASTNode): boolean {
    // Check if AST matches pattern: |z - a| = |z - b|
    if (ast.type !== 'binary' || ast.operator !== '=') return false;

    const left = ast.left;
    const right = ast.right;

    return this.isModulusOfComplexMinusConstant(left) && this.isModulusOfComplexMinusConstant(right);
  }

  private isModulusOfComplexMinusConstant(node: ASTNode): boolean {
    if (node.type === 'unary' && node.operator === '|') {
      const operand = node.operand;
      if (operand && operand.type === 'binary' && operand.operator === '-') {
        // Check if one side is 'z' and the other is a constant
        const leftIsVar = operand.left && operand.left.type === 'variable';
        const rightIsConst = operand.right && operand.right.type === 'number';
        const leftIsConst = operand.left && operand.left.type === 'number';
        const rightIsVar = operand.right && operand.right.type === 'variable';

        return (leftIsVar && rightIsConst) || (leftIsConst && rightIsVar);
      }
    }
    return false;
  }

  private extractComplexConstants(ast: ASTNode): Point[] {
    const points: Point[] = [];

    if (ast.type === 'binary' && ast.operator === '=') {
      [ast.left, ast.right].forEach(side => {
        if (side.type === 'unary' && side.operator === '|') {
          const operand = side.operand;
          if (operand && operand.type === 'binary' && operand.operator === '-') {
            if (operand.left && operand.left.type === 'number') {
              // Extract real constant
              points.push({ x: operand.left.value as number, y: 0 });
            } else if (operand.right && operand.right.type === 'number') {
              // Extract real constant
              points.push({ x: operand.right.value as number, y: 0 });
            }
          }
        }
      });
    }

    return points;
  }

  private generatePerpendicularBisector(p1: Point, p2: Point): Point[][] {
    const points: Point[] = [];
    const numPoints = 100;

    // Calculate midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Calculate direction vector perpendicular to p1-p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;

    // Perpendicular direction
    const perpX = -dy;
    const perpY = dx;

    // Normalize
    const length = Math.sqrt(perpX * perpX + perpY * perpY);
    if (length > 0) {
      const dirX = perpX / length;
      const dirY = perpY / length;

      // Generate points along the perpendicular bisector
      const lineLength = this.config.range * 2;
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1) - 0.5) * lineLength;
        points.push({
          x: midX + t * dirX,
          y: midY + t * dirY
        });
      }
    }

    return [points];
  }

  private isModulusConstantEquality(ast: ASTNode): boolean {
    // Check if AST matches pattern: |z - a| = constant
    if (ast.type !== 'binary' || ast.operator !== '=') return false;

    const left = ast.left;
    const right = ast.right;

    return this.isModulusOfComplexMinusConstant(left) && right.type === 'number';
  }

  private extractModulusConstant(ast: ASTNode): { center: Point; radius: number } | null {
    if (ast.type !== 'binary' || ast.operator !== '=') return null;

    const left = ast.left;
    const right = ast.right;

    if (this.isModulusOfComplexMinusConstant(left) && right.type === 'number') {
      const radius = right.value as number;
      const center = this.extractCenterFromModulus(left);
      if (center) {
        return { center, radius };
      }
    }

    return null;
  }

  private extractCenterFromModulus(node: ASTNode): Point | null {
    if (node.type === 'unary' && node.operator === '|') {
      const operand = node.operand;
      if (operand && operand.type === 'binary' && operand.operator === '-') {
        // Find the constant part
        if (operand.left && operand.left.type === 'number') {
          return { x: operand.left.value as number, y: 0 };
        } else if (operand.right && operand.right.type === 'number') {
          // Need to handle the sign
          const value = operand.right.value as number;
          return { x: -value, y: 0 };
        }
      } else if (node.operand && node.operand.type === 'variable') {
        // |z| = r, center at origin
        return { x: 0, y: 0 };
      }
    }
    return null;
  }

  private generateCircle(center: Point, radius: number): Point[][] {
    const points: Point[] = [];
    const numPoints = 100;

    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      points.push({
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle)
      });
    }

    return [points];
  }

  private isWeightedModulusEquality(ast: ASTNode): boolean {
    // Check if AST matches pattern: |z - a| = k|z - b| where k is a constant
    if (ast.type !== 'binary' || ast.operator !== '=') return false;

    const left = ast.left;
    const right = ast.right;

    // Check if both sides are modulus expressions
    if (!this.isModulusOfComplexMinusConstant(left) || !this.isModulusOfComplexMinusConstant(right)) {
      return false;
    }

    // Check if right side has a multiplication by a constant
    if (right.type === 'binary' && right.operator === '*') {
      const leftIsModulus = this.isModulusOfComplexMinusConstant(right.left!);
      const rightIsModulus = this.isModulusOfComplexMinusConstant(right.right!);
      const leftIsConst = right.left && right.left.type === 'number';
      const rightIsConst = right.right && right.right.type === 'number';

      return (leftIsModulus && rightIsConst) || (rightIsModulus && leftIsConst);
    }

    return true; // Both sides are simple modulus expressions (k = 1)
  }

  private extractWeightedModulusConstants(ast: ASTNode): { point1: Point; point2: Point; ratio: number } | null {
    if (ast.type !== 'binary' || ast.operator !== '=') return null;

    const left = ast.left;
    const right = ast.right;

    let point1: Point | null = null;
    let point2: Point | null = null;
    let ratio: number = 1;

    // Extract point from left side
    if (this.isModulusOfComplexMinusConstant(left)) {
      point1 = this.extractSingleComplexConstant(left);
    }

    // Extract point and ratio from right side
    if (right.type === 'binary' && right.operator === '*') {
      const modulusSide = this.isModulusOfComplexMinusConstant(right.left!) ? right.left! : right.right!;
      const constSide = right.left && right.left.type === 'number' ? right.left : right.right;

      if (this.isModulusOfComplexMinusConstant(modulusSide)) {
        point2 = this.extractSingleComplexConstant(modulusSide);
        ratio = constSide!.value as number;
      }
    } else if (this.isModulusOfComplexMinusConstant(right)) {
      point2 = this.extractSingleComplexConstant(right);
      ratio = 1;
    }

    if (point1 && point2) {
      return { point1, point2, ratio };
    }

    return null;
  }

  private extractSingleComplexConstant(node: ASTNode): Point | null {
    if (node.type === 'unary' && node.operator === '|') {
      const operand = node.operand;
      if (operand && operand.type === 'binary' && operand.operator === '-') {
        if (operand.left && operand.left.type === 'number') {
          return { x: operand.left.value as number, y: 0 };
        } else if (operand.right && operand.right.type === 'number') {
          const value = operand.right.value as number;
          return { x: -value, y: 0 };
        }
      } else if (node.operand && node.operand.type === 'variable') {
        return { x: 0, y: 0 };
      }
    }
    return null;
  }

  private generateApollonianCircle(p1: Point, p2: Point, k: number): Point[][] {
    const points: Point[] = [];
    const numPoints = 200;

    if (Math.abs(k - 1) < 0.001) {
      // k = 1, this is a perpendicular bisector (line)
      return this.generatePerpendicularBisector(p1, p2);
    }

    // For k ≠ 1, this is an Apollonian circle
    // The set of points where distance to p1 = k * distance to p2

    // Using the formula for Apollonian circles:
    // Center: (p1 - k²p2) / (1 - k²)
    // Radius: (k * |p1 - p2|) / |1 - k²|

    const k2 = k * k;
    const denominator = 1 - k2;

    const centerX = (p1.x - k2 * p2.x) / denominator;
    const centerY = (p1.y - k2 * p2.y) / denominator;

    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const radius = (k * distance) / Math.abs(denominator);

    // Generate circle points
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * 2 * Math.PI;
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      });
    }

    return [points];
  }

  private isLinearEquality(ast: ASTNode): boolean {
    // Check if AST matches patterns like: Im(z) = constant or Re(z) = constant
    console.log('isLinearEquality check - AST type:', ast.type, 'operator:', ast.operator);

    if (ast.type !== 'binary' || ast.operator !== '=') {
      console.log('Failed binary check - not binary or not = operator');
      return false;
    }

    const left = ast.left;
    const right = ast.right;

    console.log('Left AST:', JSON.stringify(left, null, 2));
    console.log('Right AST:', JSON.stringify(right, null, 2));
    console.log('Right type:', right.type);

    // Check for Im(z) = constant or Re(z) = constant (or negative constants)
    const isRightValid = right.type === 'number' ||
      (right.type === 'unary' && right.operator === '-' && right.operand && right.operand.type === 'number');

    console.log('Is right side valid:', isRightValid);

    if (isRightValid) {
      const isIm = this.isImaginaryPart(left);
      const isRe = this.isRealPart(left);
      console.log('Is imaginary part:', isIm, 'Is real part:', isRe);

      if (isIm || isRe) {
        return true;
      }
    }

    console.log('Linear equality check failed');
    return false;
  }

  private isImaginaryPart(node: ASTNode): boolean {
    // Check if this is Im(z)
    if (node.type === 'function' && node.value === 'Im') {
      if (node.args && node.args.length === 1 && node.args[0].type === 'variable') {
        return true;
      }
    }
    return false;
  }

  private isRealPart(node: ASTNode): boolean {
    // Check if this is Re(z)
    if (node.type === 'function' && node.value === 'Re') {
      if (node.args && node.args.length === 1 && node.args[0].type === 'variable') {
        return true;
      }
    }
    return false;
  }

  private extractLinearConstants(ast: ASTNode): { type: 'horizontal' | 'vertical'; value: number } | null {
    if (ast.type !== 'binary' || ast.operator !== '=') return null;

    const left = ast.left;
    const right = ast.right;

    console.log('Right side AST:', JSON.stringify(right, null, 2));
    console.log('Right side type:', right.type);

    // Handle both direct numbers and unary minus expressions
    let value: number | null = null;

    if (right.type === 'number') {
      value = right.value as number;
    } else if (right.type === 'unary' && right.operator === '-' && right.operand && right.operand.type === 'number') {
      // Handle negative numbers like -3 which parse as unary minus of number 3
      value = -(right.operand.value as number);
    }

    console.log('Extracted value:', value);

    if (value !== null) {
      if (this.isImaginaryPart(left)) {
        // Im(z) = value → horizontal line at y = value
        return { type: 'horizontal', value };
      } else if (this.isRealPart(left)) {
        // Re(z) = value → vertical line at x = value
        return { type: 'vertical', value };
      }
    }

    return null;
  }

  private generateStraightLine(lineInfo: { type: 'horizontal' | 'vertical'; value: number }): Point[][] {
    const points: Point[] = [];
    const numPoints = 100;

    if (lineInfo.type === 'horizontal') {
      // Generate horizontal line: y = value
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * 2 * this.config.range - this.config.range;
        points.push({
          x: t,
          y: lineInfo.value
        });
      }
    } else {
      // Generate vertical line: x = value
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * 2 * this.config.range - this.config.range;
        points.push({
          x: lineInfo.value,
          y: t
        });
      }
    }

    return [points];
  }

  private plotInequality(ast: ASTNode, expression: string): PlotRegion[] {
    const regions: PlotRegion[] = [];

    if (this.config.adaptiveSampling) {
      // Use adaptive sampling for better performance
      const adaptiveRegions = this.adaptiveSampleInequality(ast, expression);
      regions.push(...adaptiveRegions);
    } else {
      // Use regular grid sampling
      const gridRegions = this.gridSampleInequality(ast, expression);
      regions.push(...gridRegions);
    }

    return regions;
  }

  private plotPoint(ast: ASTNode, expression: string): PlotRegion[] {
    const regions: PlotRegion[] = [];

    // For simple points, just evaluate at z = point
    // This is mainly for named variables or constants
    const result = this.evaluator.evaluateExpression(ast, { real: 0, imaginary: 0 });

    if (result.isValid && typeof result.value !== 'boolean') {
      const complexValue = typeof result.value === 'number'
        ? { real: result.value, imaginary: 0 }
        : result.value;

      // Check if the point is within our plotting range
      if (Math.abs(complexValue.real) <= this.config.range &&
          Math.abs(complexValue.imaginary) <= this.config.range) {
        regions.push({
          points: [{ x: complexValue.real, y: complexValue.imaginary }],
          boundary: [],
          type: 'boundary',
          expression
        });
      }
    }

    return regions;
  }

  private plotComplexExpression(ast: ASTNode, expression: string): PlotRegion[] {
    // For complex expressions, we'll use grid sampling to visualize the result
    return this.gridSampleInequality(ast, expression);
  }

  private plotGeneric(ast: ASTNode, expression: string): PlotRegion[] {
    // Generic fallback - use grid sampling
    return this.gridSampleInequality(ast, expression);
  }

  private traceBoundary(ast: ASTNode): Point[][] {
    const boundaryCurves: Point[][] = [];
    const stepSize = 0.02; // Decreased step size for much smoother curves
    const maxSteps = 5000; // Increased max steps to compensate for smaller step size

    // Try to find starting points on the boundary
    const startingPoints = this.findBoundaryStartingPoints(ast);

    for (const start of startingPoints) {
      // Check if this starting point is too close to an existing curve
      // Only skip if we already have curves (don't skip the first one)
      if (boundaryCurves.length > 0 && this.isNearExistingCurve(start, boundaryCurves, 0.3)) {
        continue; // Skip if this would trace an existing curve
      }

      const path = this.traceFromPoint(ast, start, stepSize, maxSteps);
      if (path.length > 0) {
        // Temporarily disable curve similarity check for debugging
        // TODO: Re-enable this once basic tracing works
        boundaryCurves.push(path);
      }
    }

    return boundaryCurves;
  }

  // Check if two curves are essentially the same (for deduplication)
  private curvesAreSimilar(curve1: Point[], curve2: Point[], tolerance: number = 0.5): boolean {
    if (curve1.length === 0 || curve2.length === 0) return false;

    // Check if multiple points from curve1 are close to points in curve2
    let closePoints = 0;
    const sampleSize = Math.min(5, curve1.length); // Sample fewer points

    for (let i = 0; i < sampleSize; i++) {
      const point1 = curve1[Math.floor(i * curve1.length / sampleSize)];

      for (const point2 of curve2) {
        const distance = Math.sqrt(
          Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2)
        );

        if (distance < tolerance) {
          closePoints++;
          break;
        }
      }
    }

    // If most sampled points are close to the other curve, consider them similar
    return closePoints >= sampleSize * 0.8; // Require higher similarity
  }

  private findBoundaryStartingPoints(ast: ASTNode): Point[] {
    const startingPoints: Point[] = [];
    const tolerance = 0.05; // Much more relaxed tolerance for better boundary detection

    // First try a comprehensive grid search for any boundary points
    const searchStep = this.config.range / 30; // Much finer grid for better boundary detection
    for (let x = -this.config.range; x <= this.config.range; x += searchStep) {
      for (let y = -this.config.range; y <= this.config.range; y += searchStep) {
        if (this.isNearBoundary(ast, { x, y }, tolerance)) {
          // Refine the point to be more precise
          const refinedPoint = this.refineBoundaryPoint(ast, { x, y });
          if (refinedPoint) {
            startingPoints.push(refinedPoint);
          } else {
            // Fallback: use the original point if refinement fails
            startingPoints.push({ x, y });
          }
        }
      }
    }

    // If no points found with grid search, try systematic searches around different centers
    if (startingPoints.length === 0) {
      // Try circles centered at origin
      for (let radius = 0.5; radius <= this.config.range; radius += 0.5) {
        for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 8) {
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          if (this.isNearBoundary(ast, { x, y }, tolerance * 2)) {
            const refinedPoint = this.refineBoundaryPoint(ast, { x, y });
            if (refinedPoint) {
              startingPoints.push(refinedPoint);
            } else {
              // Fallback: use the original point if refinement fails
              startingPoints.push({ x, y });
            }
          }
        }
      }

      // Try circles centered at common points like (0,1), (1,0), etc.
      const centers = [
        { x: 0, y: 1 },   // Center at i
        { x: 0, y: -1 },  // Center at -i
        { x: 1, y: 0 },   // Center at 1
        { x: -1, y: 0 },  // Center at -1
      ];

      for (const center of centers) {
        for (let radius = 0.5; radius <= this.config.range; radius += 0.5) {
          for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 8) {
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            if (this.isNearBoundary(ast, { x, y }, tolerance * 2)) {
              const refinedPoint = this.refineBoundaryPoint(ast, { x, y });
              if (refinedPoint) {
                startingPoints.push(refinedPoint);
              } else {
                // Fallback: use the original point if refinement fails
                startingPoints.push({ x, y });
              }
            }
          }
        }
      }
    }

    return this.deduplicatePoints(startingPoints).slice(0, 6);
  }

  // Refine a point to be closer to the actual boundary using Newton's method
  private refineBoundaryPoint(ast: ASTNode, point: Point): Point | null {
    const maxIterations = 20; // More iterations for better convergence
    const tolerance = 0.001; // Tighter precision for better boundary detection
    let current = { ...point };

    for (let i = 0; i < maxIterations; i++) {
      const result = this.evaluator.evaluateExpression(ast, { real: current.x, imaginary: current.y });
      if (!result.isValid || typeof result.value === 'boolean') break;

      const value = typeof result.value === 'number' ? result.value : this.modulus(result.value);

      if (Math.abs(value) < tolerance) {
        return current;
      }

      // Use gradient to move toward boundary
      const gradient = this.computeGradient(ast, current);
      const magnitude = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y);

      if (magnitude < 0.01) break;

      // Newton step: move opposite to gradient scaled by function value
      const step = value / magnitude;
      current = {
        x: current.x - (gradient.x / magnitude) * step,
        y: current.y - (gradient.y / magnitude) * step
      };
    }

    // Much more relaxed final check
    const finalTolerance = tolerance * 10; // Very relaxed
    return this.isNearBoundary(ast, current, finalTolerance) ? current : null;
  }

  private isNearBoundary(ast: ASTNode, point: Point, tolerance: number): boolean {
    const z = { real: point.x, imaginary: point.y };
    const result = this.evaluator.evaluateExpression(ast, z);

    if (!result.isValid || typeof result.value === 'boolean') {
      return false;
    }

    const value = typeof result.value === 'number' ? result.value : this.modulus(result.value);
    return Math.abs(value) < tolerance;
  }

  // Check if a point is near an existing curve (for deduplication)
  private isNearExistingCurve(point: Point, curves: Point[][], tolerance: number = 0.1): boolean {
    for (const curve of curves) {
      for (const curvePoint of curve) {
        const distance = Math.sqrt(
          Math.pow(point.x - curvePoint.x, 2) + Math.pow(point.y - curvePoint.y, 2)
        );
        if (distance < tolerance) {
          return true;
        }
      }
    }
    return false;
  }

  private traceFromPoint(ast: ASTNode, start: Point, stepSize: number, maxSteps: number): Point[] {
    // Trace in both directions from the starting point for better coverage of unbounded curves
    const forwardPath = this.traceInDirection(ast, start, stepSize, maxSteps / 2, 1);
    const backwardPath = this.traceInDirection(ast, start, stepSize, maxSteps / 2, -1);

    // Combine backward (reversed) and forward paths
    const reversedBackward = backwardPath.slice().reverse();
    // Remove duplicate start point
    const fullPath = [...reversedBackward, ...forwardPath.slice(1)];

    return fullPath;
  }

  private traceInDirection(ast: ASTNode, start: Point, stepSize: number, maxSteps: number, direction: 1 | -1): Point[] {
    const path: Point[] = [start];
    let current = { ...start };
    const loopTolerance = stepSize * 1.5; // Distance to detect loop completion

    for (let step = 0; step < maxSteps; step++) {
      // Check if we've completed a loop (close to starting point)
      const distFromStart = Math.sqrt(
        Math.pow(current.x - start.x, 2) + Math.pow(current.y - start.y, 2)
      );
      if (step > 20 && distFromStart < loopTolerance) {
        // We've completed a loop - add final connection point if needed
        if (distFromStart > stepSize * 0.5) {
          // Add a point closer to the start to close the loop better
          path.push(start);
        }
        break;
      }

      // Use RK4 integration for accurate boundary following
      const next = this.rk4Step(ast, current, stepSize * direction);

      if (!next) {
        console.log('RK4 step returned null, stopping trace');
        break;
      }

      // Check for numerical issues
      if (!isFinite(next.x) || !isFinite(next.y)) {
        console.log('Numerical issues detected, stopping trace');
        break;
      }

      // Check bounds - but include the last point that's slightly out of bounds
      if (Math.abs(next.x) > this.config.range * 1.1 || Math.abs(next.y) > this.config.range * 1.1) {
        console.log(`Point (${next.x.toFixed(2)}, ${next.y.toFixed(2)}) out of bounds, stopping trace`);
        // Still add the out-of-bounds point if it's not too far
        if (Math.abs(next.x) <= this.config.range * 1.2 && Math.abs(next.y) <= this.config.range * 1.2) {
          path.push(next);
        }
        break;
      }

      path.push(next);
      current = next;
    }

    return path;
  }

  // RK4 integration for boundary tracing
  private rk4Step(ast: ASTNode, current: Point, stepSize: number): Point | null {
    // Get the perpendicular vector field (tangent to boundary)
    const getField = (point: Point): Point => {
      const gradient = this.computeGradient(ast, point);
      const magnitude = Math.sqrt(gradient.x * gradient.x + gradient.y * gradient.y);

      // Stop if gradient is too small or too large
      if (magnitude < 0.000001 || magnitude > 1000) {
        return null;
      }

      // Return normalized perpendicular to gradient
      if (magnitude < 0.0001) {
        // If gradient is very small, use a tangent direction based on position
        // For a circle |z| = r, the tangent is perpendicular to the radius vector
        const radius = Math.sqrt(point.x * point.x + point.y * point.y);
        if (radius > 0) {
          // Tangent direction is perpendicular to radius
          return {
            x: -point.y / radius,
            y: point.x / radius
          };
        } else {
          // At origin, use arbitrary direction
          return { x: 1, y: 0 };
        }
      }

      return {
        x: -gradient.y / magnitude,
        y: gradient.x / magnitude
      };
    };

    const k1 = getField(current);
    if (!k1) return null;

    const k2 = getField({
      x: current.x + 0.5 * stepSize * k1.x,
      y: current.y + 0.5 * stepSize * k1.y
    });
    if (!k2) return null;

    const k3 = getField({
      x: current.x + 0.5 * stepSize * k2.x,
      y: current.y + 0.5 * stepSize * k2.y
    });
    if (!k3) return null;

    const k4 = getField({
      x: current.x + stepSize * k3.x,
      y: current.y + stepSize * k3.y
    });
    if (!k4) return null;

    // RK4 weighted average
    return {
      x: current.x + (stepSize / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
      y: current.y + (stepSize / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)
    };
  }

  private computeGradient(ast: ASTNode, point: Point): Point {
    const h = 0.001; // Small step for numerical differentiation

    // Use central differences for better accuracy
    const resultXPlus = this.evaluator.evaluateExpression(ast, { real: point.x + h, imaginary: point.y });
    const resultXMinus = this.evaluator.evaluateExpression(ast, { real: point.x - h, imaginary: point.y });
    const resultYPlus = this.evaluator.evaluateExpression(ast, { real: point.x, imaginary: point.y + h });
    const resultYMinus = this.evaluator.evaluateExpression(ast, { real: point.x, imaginary: point.y - h });

    if (!resultXPlus.isValid || !resultXMinus.isValid || !resultYPlus.isValid || !resultYMinus.isValid) {
      return { x: 0, y: 0 };
    }

    const getValue = (result: any): number => {
      if (typeof result.value === 'boolean') return 0;
      return typeof result.value === 'number' ? result.value : this.modulus(result.value);
    };

    const valueXPlus = getValue(resultXPlus);
    const valueXMinus = getValue(resultXMinus);
    const valueYPlus = getValue(resultYPlus);
    const valueYMinus = getValue(resultYMinus);

    // Central differences: f'(x) ≈ (f(x+h) - f(x-h)) / (2h)
    return {
      x: (valueXPlus - valueXMinus) / (2 * h),
      y: (valueYPlus - valueYMinus) / (2 * h)
    };
  }

  private findContour(ast: ASTNode, level: number): Point[] {
    // Marching squares algorithm for contour detection
    const contour: Point[] = [];
    const resolution = this.config.resolution * 2; // Double resolution for better line detection
    const stepSize = (2 * this.config.range) / resolution;

    for (let i = 0; i < resolution - 1; i++) {
      for (let j = 0; j < resolution - 1; j++) {
        const x = -this.config.range + i * stepSize;
        const y = -this.config.range + j * stepSize;

        // Evaluate at corners of cell
        const corners = [
          this.evaluateAtPoint(ast, x, y),
          this.evaluateAtPoint(ast, x + stepSize, y),
          this.evaluateAtPoint(ast, x + stepSize, y + stepSize),
          this.evaluateAtPoint(ast, x, y + stepSize)
        ];

        // Check if contour passes through this cell
        if (this.contourCrossesCell(corners, level)) {
          const cellPoints = this.interpolateContour(corners, x, y, stepSize, level);
          contour.push(...cellPoints);
        }
      }
    }

    return this.deduplicatePoints(contour);
  }

  private contourCrossesCell(values: number[], level: number): boolean {
    // Check if any values are on opposite sides of the contour level
    let hasAbove = false;
    let hasBelow = false;

    for (const value of values) {
      if (value > level) hasAbove = true;
      if (value < level) hasBelow = true;
    }

    return hasAbove && hasBelow;
  }

  private interpolateContour(corners: number[], x: number, y: number, stepSize: number, level: number): Point[] {
    // Simple linear interpolation to find contour points within cell
    const points: Point[] = [];

    const positions = [
      { x, y },
      { x: x + stepSize, y },
      { x: x + stepSize, y: y + stepSize },
      { x, y: y + stepSize }
    ];

    // Check each edge of the cell
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const v1 = corners[i];
      const v2 = corners[j];

      if ((v1 <= level && v2 >= level) || (v1 >= level && v2 <= level)) {
        // Interpolate along this edge
        const t = Math.abs((level - v1) / (v2 - v1));
        points.push({
          x: positions[i].x + t * (positions[j].x - positions[i].x),
          y: positions[i].y + t * (positions[j].y - positions[i].y)
        });
      }
    }

    return points;
  }

  private gridSampleInequality(ast: ASTNode, expression: string): PlotRegion[] {
    const regions: PlotRegion[] = [];
    const resolution = this.config.resolution;
    const stepSize = (2 * this.config.range) / resolution;

    const gridData: number[][] = [];
    const points: Point[] = [];

    // Sample the entire grid
    for (let i = 0; i < resolution; i++) {
      gridData[i] = [];
      for (let j = 0; j < resolution; j++) {
        const x = -this.config.range + i * stepSize;
        const y = -this.config.range + j * stepSize;
        const value = this.evaluateAtPoint(ast, x, y);
        gridData[i][j] = value;

        // For inequality, check if condition is true
        const z = { real: x, imaginary: y };
        const result = this.evaluator.evaluateExpression(ast, z);
        if (result.isValid && (result.value as any) === true) {
          points.push({ x, y });
        }
      }
    }

    if (points.length > 0) {
      regions.push({
        points,
        boundary: [], // Can be computed separately if needed
        type: 'filled',
        expression
      });
    }

    return regions;
  }

  private adaptiveSampleInequality(ast: ASTNode, expression: string): PlotRegion[] {
    // Start with coarse grid, refine where needed
    const regions: PlotRegion[] = [];
    const points: Point[] = [];
    const initialResolution = Math.floor(this.config.resolution / 4);

    // Recursive subdivision function
    const subdivide = (x: number, y: number, size: number, depth: number) => {
      if (depth > 3 || size < 0.1) return; // Limit recursion depth

      // Sample corners of the cell
      const corners = [
        this.evaluateAtPoint(ast, x, y),
        this.evaluateAtPoint(ast, x + size, y),
        this.evaluateAtPoint(ast, x + size, y + size),
        this.evaluateAtPoint(ast, x, y + size)
      ];

      // Check if cell is homogeneous
      const isHomogeneous = corners.every(c => c === corners[0]);

      if (isHomogeneous && corners[0]) {
        // Add points if condition is true
        if (corners[0] as any > 0) {
          const subPoints = this.sampleCell(x, y, size, 3);
          points.push(...subPoints);
        }
      } else {
        // Subdivide
        const halfSize = size / 2;
        subdivide(x, y, halfSize, depth + 1);
        subdivide(x + halfSize, y, halfSize, depth + 1);
        subdivide(x, y + halfSize, halfSize, depth + 1);
        subdivide(x + halfSize, y + halfSize, halfSize, depth + 1);
      }
    };

    // Start subdivision
    const initialSize = (2 * this.config.range) / initialResolution;
    for (let i = 0; i < initialResolution; i++) {
      for (let j = 0; j < initialResolution; j++) {
        const x = -this.config.range + i * initialSize;
        const y = -this.config.range + j * initialSize;
        subdivide(x, y, initialSize, 0);
      }
    }

    if (points.length > 0) {
      regions.push({
        points,
        boundary: [],
        type: 'filled',
        expression
      });
    }

    return regions;
  }

  private sampleCell(x: number, y: number, size: number, samplesPerSide: number): Point[] {
    const points: Point[] = [];
    const step = size / (samplesPerSide - 1);

    for (let i = 0; i < samplesPerSide; i++) {
      for (let j = 0; j < samplesPerSide; j++) {
        points.push({
          x: x + i * step,
          y: y + j * step
        });
      }
    }

    return points;
  }

  private evaluateAtPoint(ast: ASTNode, x: number, y: number): number {
    const z = { real: x, imaginary: y };
    const result = this.evaluator.evaluateExpression(ast, z);

    if (!result.isValid) return 0;

    if (typeof result.value === 'boolean') {
      return result.value ? 1 : 0;
    } else if (typeof result.value === 'number') {
      return result.value;
    } else {
      return this.modulus(result.value);
    }
  }

  private deduplicatePoints(points: Point[]): Point[] {
    const seen = new Set<string>();
    const deduplicated: Point[] = [];

    for (const point of points) {
      const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(point);
      }
    }

    return deduplicated;
  }

  private calculateBoundingBox(regions: PlotRegion[]): { min: Point; max: Point } {
    let min = { x: Infinity, y: Infinity };
    let max = { x: -Infinity, y: -Infinity };

    for (const region of regions) {
      for (const point of [...region.points, ...region.boundary]) {
        min.x = Math.min(min.x, point.x);
        min.y = Math.min(min.y, point.y);
        max.x = Math.max(max.x, point.x);
        max.y = Math.max(max.y, point.y);
      }
    }

    // Default bounds if no points found
    if (min.x === Infinity) {
      min = { x: -this.config.range, y: -this.config.range };
      max = { x: this.config.range, y: this.config.range };
    }

    return { min, max };
  }

  private modulus(z: ComplexNumber): number {
    return Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
  }
}
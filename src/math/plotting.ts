import { ASTNode, PlotExpression } from '../types/expressions';
import { ComplexNumber, PlotConfig, Point } from '../types/complex';
import { ExpressionEvaluator } from './evaluator';

export interface PlotRegion {
  points: Point[];
  boundary: Point[] | Point[][]; // Single boundary or array of boundary curves
  type: 'filled' | 'boundary' | 'both';
  value?: number;
  expression: string;
  color?: string;
  lineThickness?: number;
}

export type { PlotConfig };

export interface CurveState {
  endpoints: Point[]; // First and last points of each curve
  intermediatePoints: Point[][]; // Periodic points along longer curves
  lastUpdate: number; // Timestamp for cache invalidation
  viewportHash: string; // Hash of viewport when curves were computed
}

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

  // Curve state tracking for continuity across viewport changes
  private previousCurves: { [expression: string]: CurveState } = {};

  constructor(config: PlotConfig) {
    this.evaluator = new ExpressionEvaluator();
    this.config = config;
  }

  // Calculate current viewport range based on viewport settings
  private getViewportRange(): { minX: number; maxX: number; minY: number; maxY: number; range: number } {
    if (this.config.viewportOffsetX !== undefined &&
        this.config.viewportOffsetY !== undefined &&
        this.config.viewportZoom !== undefined) {

      // Calculate visible range in math coordinates
      const baseRange = this.config.range;
      const scaledRange = baseRange / this.config.viewportZoom;

      // Add buffer around viewport for smoother curve rendering
      const buffer = scaledRange * 0.5; // 50% buffer around visible area

      return {
        minX: this.config.viewportOffsetX - scaledRange - buffer,
        maxX: this.config.viewportOffsetX + scaledRange + buffer,
        minY: this.config.viewportOffsetY - scaledRange - buffer,
        maxY: this.config.viewportOffsetY + scaledRange + buffer,
        range: scaledRange + buffer
      };
    }

    // Fallback to original behavior if no viewport info
    const range = this.config.range;
    const buffer = range * 0.5; // 50% buffer for consistency
    return {
      minX: -range - buffer,
      maxX: range + buffer,
      minY: -range - buffer,
      maxY: range + buffer,
      range: range + buffer
    };
  }

  updateConfig(config: Partial<PlotConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Helper methods for curve state management
  private getViewportHash(): string {
    const viewportRange = this.getViewportRange();
    return `${viewportRange.minX.toFixed(3)},${viewportRange.maxX.toFixed(3)},${viewportRange.minY.toFixed(3)},${viewportRange.maxY.toFixed(3)}`;
  }

  private extractCurveKeyPoints(curves: Point[][]): { endpoints: Point[]; intermediatePoints: Point[][] } {
    const endpoints: Point[] = [];
    const intermediatePoints: Point[][] = [];

    for (const curve of curves) {
      if (curve.length === 0) continue;

      // Add first and last points as endpoints
      endpoints.push(curve[0]);
      if (curve.length > 1) {
        endpoints.push(curve[curve.length - 1]);
      }

      // For curves with 3+ points, add intermediate points for better continuity
      if (curve.length >= 3) {
        const numIntermediatePoints = Math.min(10, Math.max(1, Math.floor(curve.length / 3))); // At least 1 intermediate point
        const step = Math.max(1, Math.floor(curve.length / (numIntermediatePoints + 1)));
        const intermediate: Point[] = [];
        for (let i = step; i < curve.length - step; i += step) {
          intermediate.push(curve[i]);
        }
        if (intermediate.length > 0) {
          intermediatePoints.push(intermediate);
        }
      }
    }

    return { endpoints, intermediatePoints };
  }

  private saveCurveState(expression: string, curves: Point[][]): void {
    const keyPoints = this.extractCurveKeyPoints(curves);
    this.previousCurves[expression] = {
      ...keyPoints,
      lastUpdate: Date.now(),
      viewportHash: this.getViewportHash()
    };
  }

  private getLegacyStartingPoints(expression: string): Point[] {
    const previousState = this.previousCurves[expression];
    if (!previousState) return [];

    const viewportRange = this.getViewportRange();
    const legacyPoints: Point[] = [];
    const extensionBuffer = viewportRange.range * 0.1; // 10% extension beyond viewport

    // Extended viewport boundaries for edge cases
    const extendedMinX = viewportRange.minX - extensionBuffer;
    const extendedMaxX = viewportRange.maxX + extensionBuffer;
    const extendedMinY = viewportRange.minY - extensionBuffer;
    const extendedMaxY = viewportRange.maxY + extensionBuffer;

    // Check endpoints first with extended boundaries
    for (const point of previousState.endpoints) {
      if (point.x >= extendedMinX && point.x <= extendedMaxX &&
          point.y >= extendedMinY && point.y <= extendedMaxY) {
        legacyPoints.push(point);
      }
    }

    // Then check intermediate points with extended boundaries
    for (const points of previousState.intermediatePoints) {
      for (const point of points) {
        if (point.x >= extendedMinX && point.x <= extendedMaxX &&
            point.y >= extendedMinY && point.y <= extendedMaxY) {
          legacyPoints.push(point);
        }
      }
    }

    return legacyPoints;
  }

  // Main plotting function for expressions
  plotExpression(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlottingResult {
    const startTime = performance.now();

    try {
      // Analyze expression type to choose best plotting method
      const expressionType = this.analyzeExpression(ast);

      let regions: PlotRegion[] = [];

      switch (expressionType) {
        case 'equality':
          regions = this.plotEquality(ast, expression, expressionConfig);
          break;
        case 'inequality':
          regions = this.plotInequality(ast, expression, expressionConfig);
          break;
        case 'point':
          regions = this.plotPoint(ast, expression, expressionConfig);
          break;
        case 'complex':
          regions = this.plotComplexExpression(ast, expression, expressionConfig);
          break;
        default:
          regions = this.plotGeneric(ast, expression, expressionConfig);
      }

      const endTime = performance.now();

      // If no regions were found, create a default viewport-based bounding box
      if (regions.length === 0) {
        const viewportRange = this.getViewportRange();
        return {
          regions: [],
          error: 'No regions found',
          metadata: {
            resolution: this.config.resolution,
            boundingBox: {
              min: { x: viewportRange.minX, y: viewportRange.minY },
              max: { x: viewportRange.maxX, y: viewportRange.maxY }
            },
            computationTime: endTime - startTime
          }
        };
      }

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
          boundingBox: { min: { x: -this.config.range, y: -this.config.range }, max: { x: this.config.range, y: this.config.range } }, // Keep original range for error cases
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

  private plotEquality(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
    const regions: PlotRegion[] = [];

    // Check if this is a simple linear modulus equality like |z| = |z-1|
    const analyticBoundary = this.tryAnalyticSolution(ast);
    if (analyticBoundary) {
      // Save curve state for continuity even with analytical solutions
      this.saveCurveState(expression, analyticBoundary);

      regions.push({
        points: [],
        boundary: analyticBoundary,
        type: 'boundary',
        expression,
        color: expressionConfig?.color,
        lineThickness: expressionConfig?.lineThickness,
      });
      return regions;
    }

    // Transform equality to zero-based form for boundary tracing
    // For example: |z| = 1 becomes |z| - 1, then we look for where it equals 0
    const zeroBasedAst = this.transformToZeroBased(ast);

    // Try boundary tracing first for polynomial equalities
    const boundaryCurves = this.traceBoundary(zeroBasedAst, expression);

    if (boundaryCurves.length > 0) {
      regions.push({
        points: [],
        boundary: boundaryCurves,
        type: 'boundary',
        expression,
        color: expressionConfig?.color,
        lineThickness: expressionConfig?.lineThickness,
      });
    } else {
      // Fallback to contour detection with higher resolution
      const contourPoints = this.findContour(zeroBasedAst, 0);
      regions.push({
        points: [],
        boundary: contourPoints,
        type: 'boundary',
        expression,
        color: expressionConfig?.color,
        lineThickness: expressionConfig?.lineThickness,
      });
    }

    return regions;
  }

  // Try to find analytical solutions for simple modulus equalities
  private tryAnalyticSolution(ast: ASTNode): Point[][] | null {
    // Check for |Re(z)| = constant or |Im(z)| = constant patterns
    if (this.isRealImagModulusEquality(ast)) {
      const lineCurves = this.generateRealImagModulusLine(ast);
      if (lineCurves) {
        return lineCurves;
      }
    }

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

      // Generate points along the perpendicular bisector using viewport range
      const viewportRange = this.getViewportRange();
      const lineLength = Math.max(viewportRange.maxX - viewportRange.minX, viewportRange.maxY - viewportRange.minY);
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

    // Use viewport range instead of fixed config range
    const viewportRange = this.getViewportRange();

    if (lineInfo.type === 'horizontal') {
      // Generate horizontal line: y = value
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * (viewportRange.maxX - viewportRange.minX) + viewportRange.minX;
        points.push({
          x: t,
          y: lineInfo.value
        });
      }
    } else {
      // Generate vertical line: x = value
      for (let i = 0; i < numPoints; i++) {
        const t = (i / (numPoints - 1)) * (viewportRange.maxY - viewportRange.minY) + viewportRange.minY;
        points.push({
          x: lineInfo.value,
          y: t
        });
      }
    }

    return [points];
  }

  private plotInequality(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
    const regions: PlotRegion[] = [];

    if (this.config.adaptiveSampling) {
      // Use adaptive sampling for better performance
      const adaptiveRegions = this.adaptiveSampleInequality(ast, expression, expressionConfig);
      regions.push(...adaptiveRegions);
    } else {
      // Use regular grid sampling
      const gridRegions = this.gridSampleInequality(ast, expression, expressionConfig);
      regions.push(...gridRegions);
    }

    return regions;
  }

  private plotPoint(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
    const regions: PlotRegion[] = [];

    // For simple points, just evaluate at z = point
    // This is mainly for named variables or constants
    const result = this.evaluator.evaluateExpression(ast, { real: 0, imaginary: 0 });

    if (result.isValid && typeof result.value !== 'boolean') {
      const complexValue = typeof result.value === 'number'
        ? { real: result.value, imaginary: 0 }
        : result.value;

      // Check if the point is within our plotting range using viewport
      const viewportRange = this.getViewportRange();
      if (complexValue.real >= viewportRange.minX && complexValue.real <= viewportRange.maxX &&
          complexValue.imaginary >= viewportRange.minY && complexValue.imaginary <= viewportRange.maxY) {
        regions.push({
          points: [{ x: complexValue.real, y: complexValue.imaginary }],
          boundary: [],
          type: 'boundary',
          expression,
          color: expressionConfig?.color,
          lineThickness: expressionConfig?.lineThickness,
        });
      }
    }

    return regions;
  }

  private plotComplexExpression(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
    // For complex expressions, we'll use grid sampling to visualize the result
    return this.gridSampleInequality(ast, expression, expressionConfig);
  }

  private plotGeneric(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
    // Generic fallback - use grid sampling
    return this.gridSampleInequality(ast, expression, expressionConfig);
  }

  private traceBoundary(ast: ASTNode, expression?: string): Point[][] {
    const boundaryCurves: Point[][] = [];

    // Adaptive step size and max steps based on viewport range
    const viewportRange = this.getViewportRange();
    const viewportSize = Math.max(viewportRange.maxX - viewportRange.minX, viewportRange.maxY - viewportRange.minY);
    const stepSize = Math.max(0.02, viewportSize / 1000); // Adaptive step size
    const maxSteps = Math.max(5000, Math.floor(viewportSize / stepSize * 2)); // Adaptive max steps

    // Try to find starting points on the boundary
    const startingPoints = this.findBoundaryStartingPoints(ast, expression);

    for (const start of startingPoints) {
      // Check if this starting point is too close to an existing curve
      // Only skip if we already have curves (don't skip the first one)
      if (boundaryCurves.length > 0 && this.isNearExistingCurve(start, boundaryCurves, 0.3)) {
        continue; // Skip if this would trace an existing curve
      }

      const path = this.traceFromPoint(ast, start, stepSize, maxSteps);
      if (path.length > 0) {
        // Check if this path is similar to any existing curves to prevent duplicates
        let isDuplicate = false;
        for (const existingCurve of boundaryCurves) {
          if (this.curvesAreSimilar(path, existingCurve, 0.5)) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          boundaryCurves.push(path);
        }
      }
    }

    // Save curve state for continuity in future viewport updates
    if (expression && boundaryCurves.length > 0) {
      this.saveCurveState(expression, boundaryCurves);
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

  private findBoundaryStartingPoints(ast: ASTNode, expression?: string): Point[] {
    const startingPoints: Point[] = [];
    const tolerance = 0.05;

    // Phase 1: Add intelligent starting points based on expression patterns
    const intelligentPoints = this.generateIntelligentStartingPoints(ast, expression);

    for (const point of intelligentPoints) {
      if (this.isNearBoundary(ast, point, tolerance * 3)) {
        const refinedPoint = this.refineBoundaryPoint(ast, point);
        if (refinedPoint) {
          startingPoints.push(refinedPoint);
        } else {
          startingPoints.push(point);
        }
      }
    }

    // Phase 2: Add legacy points from previous curves if available
    if (expression) {
      const legacyPoints = this.getLegacyStartingPoints(expression);

      for (const point of legacyPoints) {
        // Verify legacy points still satisfy the boundary condition with more lenient tolerance
        if (this.isNearBoundary(ast, point, tolerance * 5)) {
          const refinedPoint = this.refineBoundaryPoint(ast, point);
          if (refinedPoint) {
            startingPoints.push(refinedPoint);
          } else {
            startingPoints.push(point);
          }
        } else {
          // Even if not near boundary, still include the point as fallback
          startingPoints.push(point);
        }
      }
    }

    // Phase 2: Grid search for additional starting points
    // Use viewport range instead of fixed range
    const viewportRange = this.getViewportRange();

    // Use balanced grid search - good compromise between performance and coverage
    const searchStep = viewportRange.range / 35; // ~36x36 grid (30% reduction from 51x51)

    // Always scan in the same order for consistency
    for (let x = viewportRange.minX; x <= viewportRange.maxX; x += searchStep) {
      for (let y = viewportRange.minY; y <= viewportRange.maxY; y += searchStep) {
        // Skip points that are too close to existing legacy points
        const tooClose = startingPoints.some(sp =>
          Math.sqrt(Math.pow(sp.x - x, 2) + Math.pow(sp.y - y, 2)) < searchStep * 0.5
        );

        if (tooClose) continue;

        if (this.isNearBoundary(ast, { x, y }, tolerance)) {
          const refinedPoint = this.refineBoundaryPoint(ast, { x, y });
          if (refinedPoint) {
            startingPoints.push(refinedPoint);
          } else {
            startingPoints.push({ x, y });
          }
        }
      }
    }

    // If no points found with grid search, try systematic searches around different centers
    if (startingPoints.length === 0) {
      // Try circles centered at origin using viewport range, extended for zoom-out
      const maxRadius = Math.max(viewportRange.range * 2, 10); // Search much further when zoomed out
      for (let radius = 0.5; radius <= maxRadius; radius += 0.5) {
        for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 16) { // Higher angular resolution
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
        for (let radius = 0.5; radius <= maxRadius; radius += 0.5) {
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

    const deduplicated = this.deduplicatePoints(startingPoints);

    // Smart selection: prioritize spatially diverse points with balanced limit
    if (deduplicated.length > 35) {
      return this.selectDiversePoints(deduplicated, 35); // Select up to 35 diverse points (30% reduction from 50)
    }
    return deduplicated; // Use all points if less than 35
  }

  // Refine a point to be closer to the actual boundary using Newton's method
  private refineBoundaryPoint(ast: ASTNode, point: Point): Point | null {
    const maxIterations = 35; // Balanced iterations - good precision with reasonable performance
    const tolerance = 0.0003; // Good precision for visual continuity
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

      // Check bounds using viewport range - but include the last point that's slightly out of bounds
      const viewportRange = this.getViewportRange();
      const maxBound = Math.max(Math.abs(viewportRange.minX), Math.abs(viewportRange.maxX),
                               Math.abs(viewportRange.minY), Math.abs(viewportRange.maxY));

      if (Math.abs(next.x) > maxBound * 1.1 || Math.abs(next.y) > maxBound * 1.1) {
        console.log(`Point (${next.x.toFixed(2)}, ${next.y.toFixed(2)}) out of bounds, stopping trace`);
        // Still add the out-of-bounds point if it's not too far
        if (Math.abs(next.x) <= maxBound * 1.2 && Math.abs(next.y) <= maxBound * 1.2) {
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

    // Use viewport range instead of fixed config range
    const viewportRange = this.getViewportRange();
    const stepSizeX = (viewportRange.maxX - viewportRange.minX) / resolution;
    const stepSizeY = (viewportRange.maxY - viewportRange.minY) / resolution;

    for (let i = 0; i < resolution - 1; i++) {
      for (let j = 0; j < resolution - 1; j++) {
        const x = viewportRange.minX + i * stepSizeX;
        const y = viewportRange.minY + j * stepSizeY;

        // Evaluate at corners of cell
        const corners = [
          this.evaluateAtPoint(ast, x, y),
          this.evaluateAtPoint(ast, x + stepSizeX, y),
          this.evaluateAtPoint(ast, x + stepSizeX, y + stepSizeY),
          this.evaluateAtPoint(ast, x, y + stepSizeY)
        ];

        // Check if contour passes through this cell
        if (this.contourCrossesCell(corners, level)) {
          const cellPoints = this.interpolateContour(corners, x, y, (stepSizeX + stepSizeY) / 2, level);
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

  private gridSampleInequality(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
    const regions: PlotRegion[] = [];
    const resolution = this.config.resolution;

    // Use viewport range instead of fixed range
    const viewportRange = this.getViewportRange();
    const range = viewportRange.range;
    const stepSize = (2 * range) / resolution;

    const gridData: number[][] = [];
    const points: Point[] = [];

    // Sample the entire grid using viewport bounds
    for (let i = 0; i < resolution; i++) {
      gridData[i] = [];
      for (let j = 0; j < resolution; j++) {
        const x = viewportRange.minX + i * stepSize;
        const y = viewportRange.minY + j * stepSize;
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
        expression,
        color: expressionConfig?.color,
        lineThickness: expressionConfig?.lineThickness,
      });
    }

    return regions;
  }

  private adaptiveSampleInequality(ast: ASTNode, expression: string, expressionConfig?: PlotExpression): PlotRegion[] {
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

    // Start subdivision with viewport range
    const viewportRange = this.getViewportRange();
    const initialSizeX = (viewportRange.maxX - viewportRange.minX) / initialResolution;
    const initialSizeY = (viewportRange.maxY - viewportRange.minY) / initialResolution;

    for (let i = 0; i < initialResolution; i++) {
      for (let j = 0; j < initialResolution; j++) {
        const x = viewportRange.minX + i * initialSizeX;
        const y = viewportRange.minY + j * initialSizeY;
        subdivide(x, y, Math.max(initialSizeX, initialSizeY), 0);
      }
    }

    if (points.length > 0) {
      regions.push({
        points,
        boundary: [],
        type: 'filled',
        expression,
        color: expressionConfig?.color,
        lineThickness: expressionConfig?.lineThickness,
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

  // Select spatially diverse points to ensure good coverage of different curve components
  private selectDiversePoints(points: Point[], maxPoints: number): Point[] {
    if (points.length <= maxPoints) return points;

    const selected: Point[] = [];
    const remaining = [...points];

    // Start with the point closest to origin as anchor
    remaining.sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y));
    selected.push(remaining.shift()!);

    // Greedy selection: always pick the point farthest from existing selected points
    while (selected.length < maxPoints && remaining.length > 0) {
      let farthestIndex = 0;
      let farthestDistance = 0;

      for (let i = 0; i < remaining.length; i++) {
        const point = remaining[i];
        let minDistance = Infinity;

        // Find distance to closest selected point
        for (const selectedPoint of selected) {
          const distance = Math.sqrt(
            Math.pow(point.x - selectedPoint.x, 2) + Math.pow(point.y - selectedPoint.y, 2)
          );
          minDistance = Math.min(minDistance, distance);
        }

        // Select the point with maximum minimum distance
        if (minDistance > farthestDistance) {
          farthestDistance = minDistance;
          farthestIndex = i;
        }
      }

      selected.push(remaining.splice(farthestIndex, 1)[0]);
    }

    return selected;
  }

  // Generate intelligent starting points based on expression patterns
  private generateIntelligentStartingPoints(ast: ASTNode, expression?: string): Point[] {
    const points: Point[] = [];
    const viewportRange = this.getViewportRange();

    if (!expression) return points;

    // Pattern 1: |Re(z)| = constant -> vertical lines
    if (expression.includes('|Re(z)|') || expression.includes('abs(Re(z))')) {
      const match = expression.match(/=\s*([+-]?\d*\.?\d+)/);
      if (match) {
        const value = parseFloat(match[1]);
        // Generate balanced points along vertical lines - moderate coverage with legacy continuity
        for (let y = viewportRange.minY; y <= viewportRange.maxY; y += (viewportRange.maxY - viewportRange.minY) / 12) {
          points.push({ x: value, y });
          points.push({ x: -value, y }); // Both positive and negative
        }
      }
    }

    // Pattern 2: |Im(z)| = constant -> horizontal lines
    if (expression.includes('|Im(z)|') || expression.includes('abs(Im(z))')) {
      const match = expression.match(/=\s*([+-]?\d*\.?\d+)/);
      if (match) {
        const value = parseFloat(match[1]);
        // Generate balanced points along horizontal lines - moderate coverage with legacy continuity
        for (let x = viewportRange.minX; x <= viewportRange.maxX; x += (viewportRange.maxX - viewportRange.minX) / 12) {
          points.push({ x, y: value });
          points.push({ x, y: -value }); // Both positive and negative
        }
      }
    }

    // Pattern 2.5: |Re(z)+Im(z)| = constant -> diagonal lines
    if (expression.includes('|Re(z)+Im(z)|') || expression.includes('abs(Re(z)+Im(z))')) {
      const match = expression.match(/=\s*([+-]?\d*\.?\d+)/);
      if (match) {
        const value = parseFloat(match[1]);
        // Generate points along diagonal line x + y = value and x + y = -value
        const step = Math.max(viewportRange.range / 25, 0.15); // Moderate density

        // Line 1: x + y = value (y = value - x)
        for (let x = viewportRange.minX; x <= viewportRange.maxX; x += step) {
          const y = value - x;
          points.push({ x, y });
        }

        // Line 2: x + y = -value (y = -value - x)
        for (let x = viewportRange.minX; x <= viewportRange.maxX; x += step) {
          const y = -value - x;
          points.push({ x, y });
        }
      }
    }

    // Pattern 2.6: |Re(z)-Im(z)| = constant -> other diagonal lines
    if (expression.includes('|Re(z)-Im(z)|') || expression.includes('abs(Re(z)-Im(z))')) {
      const match = expression.match(/=\s*([+-]?\d*\.?\d+)/);
      if (match) {
        const value = parseFloat(match[1]);
        // Generate points along diagonal line x - y = value and x - y = -value
        const step = Math.max(viewportRange.range / 25, 0.15); // Moderate density

        // Line 1: x - y = value (y = x - value)
        for (let x = viewportRange.minX; x <= viewportRange.maxX; x += step) {
          const y = x - value;
          points.push({ x, y });
        }

        // Line 2: x - y = -value (y = x + value)
        for (let x = viewportRange.minX; x <= viewportRange.maxX; x += step) {
          const y = x + value;
          points.push({ x, y });
        }
      }
    }

    // Pattern 3: |z - a| = r -> circles
    if (expression.includes('|z') && expression.includes('|')) {
      // Generate points around circles at different angles
      for (let radius = 1; radius <= 5; radius++) {
        for (let angle = 0; angle < 2 * Math.PI; angle += Math.PI / 8) {
          points.push({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
          });
        }
      }
    }

    // Pattern 4: Re(z) = constant or Im(z) = constant
    if (expression.includes('Re(z)') || expression.includes('Im(z)')) {
      const match = expression.match(/=\s*([+-]?\d*\.?\d+)/);
      if (match) {
        const value = parseFloat(match[1]);
        if (expression.includes('Re(z)')) {
          // Vertical line
          for (let y = viewportRange.minY; y <= viewportRange.maxY; y += (viewportRange.maxY - viewportRange.minY) / 5) {
            points.push({ x: value, y });
          }
        } else {
          // Horizontal line
          for (let x = viewportRange.minX; x <= viewportRange.maxX; x += (viewportRange.maxX - viewportRange.minX) / 5) {
            points.push({ x, y: value });
          }
        }
      }
    }

    // Pattern 4.5: General linear combinations a*Re(z) + b*Im(z) = constant
    if (expression.includes('Re(z)') && expression.includes('Im(z)') &&
        (expression.includes('+') || expression.includes('-'))) {
      // Try to match patterns like a*Re(z) + b*Im(z) = c
      const linearMatch = expression.match(/([+-]?\d*\.?\d*)\*?Re\(z\)\s*([+-])\s*([+-]?\d*\.?\d*)\*?Im\(z\)\s*=\s*([+-]?\d*\.?\d+)/);
      if (linearMatch) {
        const a = parseFloat(linearMatch[1] || '1');
        const op = linearMatch[2];
        const b = parseFloat(linearMatch[3] || '1');
        const c = parseFloat(linearMatch[4]);

        const actualB = op === '-' ? -b : b;

        // Generate points along the line a*x + b*y = c
        const step = Math.max(viewportRange.range / 25, 0.15);

        for (let x = viewportRange.minX; x <= viewportRange.maxX; x += step) {
          if (actualB !== 0) {
            const y = (c - a * x) / actualB;
            points.push({ x, y });
          }
        }

        // Also generate points solving for x if b is small
        if (Math.abs(actualB) < 0.1 && a !== 0) {
          for (let y = viewportRange.minY; y <= viewportRange.maxY; y += step) {
            const x = (c - actualB * y) / a;
            points.push({ x, y });
          }
        }
      }
    }

    // Pattern 5: Polynomial expressions -> generate points near critical areas
    if (expression.includes('z^') || expression.includes('z*z') || expression.includes('z**')) {
      // Grid around origin and key points
      for (let x = -3; x <= 3; x += 1.5) {
        for (let y = -3; y <= 3; y += 1.5) {
          points.push({ x, y });
        }
      }
    }

    // Filter points to be within extended viewport
    const extensionBuffer = viewportRange.range * 0.5;
    return points.filter(p =>
      p.x >= viewportRange.minX - extensionBuffer &&
      p.x <= viewportRange.maxX + extensionBuffer &&
      p.y >= viewportRange.minY - extensionBuffer &&
      p.y <= viewportRange.maxY + extensionBuffer
    );
  }

  private calculateBoundingBox(regions: PlotRegion[]): { min: Point; max: Point } {
    let min = { x: Infinity, y: Infinity };
    let max = { x: -Infinity, y: -Infinity };

    for (const region of regions) {
      for (const point of region.points) {
        min.x = Math.min(min.x, point.x);
        min.y = Math.min(min.y, point.y);
        max.x = Math.max(max.x, point.x);
        max.y = Math.max(max.y, point.y);
      }

      // Handle boundary which can be Point[] or Point[][]
      if (Array.isArray(region.boundary)) {
        if (region.boundary.length > 0 && Array.isArray(region.boundary[0])) {
          // Point[][]
          for (const curve of region.boundary as Point[][]) {
            for (const point of curve) {
              min.x = Math.min(min.x, point.x);
              min.y = Math.min(min.y, point.y);
              max.x = Math.max(max.x, point.x);
              max.y = Math.max(max.y, point.y);
            }
          }
        } else {
          // Point[]
          for (const point of region.boundary as Point[]) {
            min.x = Math.min(min.x, point.x);
            min.y = Math.min(min.y, point.y);
            max.x = Math.max(max.x, point.x);
            max.y = Math.max(max.y, point.y);
          }
        }
      }
    }

    // Default bounds if no points found
    if (min.x === Infinity) {
      const viewportRange = this.getViewportRange();
      min = { x: viewportRange.minX, y: viewportRange.minY };
      max = { x: viewportRange.maxX, y: viewportRange.maxY };
    }

    return { min, max };
  }

  private modulus(z: ComplexNumber): number {
    return Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
  }

  // Check if this is |Re(z)| = constant or |Im(z)| = constant
  private isRealImagModulusEquality(ast: ASTNode): boolean {
    if (ast.type !== 'binary' || ast.operator !== '=') return false;

    // Check left side is modulus function
    if (ast.left?.type !== 'modulus') return false;

    // Check right side is a number
    if (ast.right?.type !== 'number') return false;

    // Check modulus operand is Re(z) or Im(z)
    const operand = ast.left.operand;
    if (operand?.type !== 'function') return false;

    return operand.value === 'Re' || operand.value === 'Im';
  }

  // Generate line points for |Re(z)| = constant or |Im(z)| = constant
  private generateRealImagModulusLine(ast: ASTNode): Point[][] | null {
    if (ast.type !== 'binary' || ast.operator !== '=') return null;
    if (ast.right?.type !== 'number') return null;
    if (ast.left?.type !== 'modulus') return null;
    if (ast.left.operand?.type !== 'function') return null;

    const constant = Math.abs(typeof ast.right.value === 'number' ? ast.right.value : parseFloat(ast.right.value.toString()));
    const functionName = typeof ast.left.operand.value === 'string' ? ast.left.operand.value : ast.left.operand.value.toString();

    const viewportRange = this.getViewportRange();
    const numPoints = 100;
    const curves: Point[][] = [];

    if (functionName === 'Re') {
      // |Re(z)| = constant creates vertical lines at x = constant and x = -constant
      // Generate each line as a separate curve
      for (const x of [constant, -constant]) {
        const points: Point[] = [];
        const yMin = viewportRange.minY;
        const yMax = viewportRange.maxY;
        const step = (yMax - yMin) / numPoints;

        for (let i = 0; i <= numPoints; i++) {
          const y = yMin + i * step;
          points.push({ x, y });
        }
        curves.push(points);
      }
    } else if (functionName === 'Im') {
      // |Im(z)| = constant creates horizontal lines at y = constant and y = -constant
      // Generate each line as a separate curve
      for (const y of [constant, -constant]) {
        const points: Point[] = [];
        const xMin = viewportRange.minX;
        const xMax = viewportRange.maxX;
        const step = (xMax - xMin) / numPoints;

        for (let i = 0; i <= numPoints; i++) {
          const x = xMin + i * step;
          points.push({ x, y });
        }
        curves.push(points);
      }
    }

    return curves.length > 0 ? curves : null;
  }
}
import { ExpressionParser } from '../../../src/math/parser';
import { ExpressionEvaluator } from '../../../src/math/evaluator';
import { HybridPlotter } from '../../../src/math/plotting';
import { createComplex } from '../../setup';
import type { Point, PlotConfig } from '../../../src/types/complex';

describe('HybridPlotter - Curve Drawing', () => {
  let parser: ExpressionParser;
  let evaluator: ExpressionEvaluator;
  let plotter: HybridPlotter;
  const defaultConfig: PlotConfig = {
    range: 5,
    resolution: 100,
    stepSize: 0.02,
    maxSteps: 2000
  };

  beforeEach(() => {
    parser = new ExpressionParser();
    evaluator = new ExpressionEvaluator();
    plotter = new HybridPlotter(defaultConfig);
  });

  // Test utilities for curve validation
  const expectCurveComponent = (boundary: Point[] | Point[][], expectedComponents: number) => {
    if (Array.isArray(boundary[0])) {
      expect(boundary.length).toBeGreaterThanOrEqual(expectedComponents);
    } else {
      expect(boundary).toBeDefined();
      if (expectedComponents === 1) {
        expect(Array.isArray(boundary)).toBe(true);
      } else {
        expect.fail(`Expected ${expectedComponents} components but got single array`);
      }
    }
  };

  const expectPointsOnCurve = (points: Point[], expression: string, tolerance = 0.05) => {
    // Check a sample of points (not all for performance)
    const sampleIndices = [
      0,
      Math.floor(points.length * 0.25),
      Math.floor(points.length * 0.5),
      Math.floor(points.length * 0.75),
      Math.max(0, points.length - 1)
    ];

    sampleIndices.forEach(index => {
      if (index < points.length) {
        const point = points[index];
        const z = createComplex(point.x, point.y);

        // For equality expressions like |z| - 1, check that |z| ≈ 1
        if (expression.includes('|z| - 1')) {
          const radius = Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
          expect(Math.abs(radius - 1)).toBeLessThan(tolerance);
        } else if (expression.includes('|z| - 2')) {
          const radius = Math.sqrt(z.real * z.real + z.imaginary * z.imaginary);
          expect(Math.abs(radius - 2)).toBeLessThan(tolerance);
        } else if (expression.includes('|z - 1| - 1')) {
          const distFromOne = Math.sqrt((z.real - 1) * (z.real - 1) + z.imaginary * z.imaginary);
          expect(Math.abs(distFromOne - 1)).toBeLessThan(tolerance);
        } else if (expression.includes('|z^2 + 1| - 2')) {
          const zSquared = { real: z.real * z.real - z.imaginary * z.imaginary, imaginary: 2 * z.real * z.imaginary };
          const value = Math.sqrt((zSquared.real + 1) * (zSquared.real + 1) + zSquared.imaginary * zSquared.imaginary);
          expect(Math.abs(value - 2)).toBeLessThan(tolerance);
        } else {
          // Fallback: parse and evaluate directly
          const parseResult = parser.parseExpressionString(expression);
          if (!parseResult.error) {
            const evaluation = evaluator.evaluateExpression(parseResult.ast, z);
            if (evaluation.isValid && typeof evaluation.value === 'number' && !isNaN(evaluation.value)) {
              expect(Math.abs(evaluation.value)).toBeLessThan(tolerance);
            }
          }
        }
      }
    });
  };

  const expectCircleShape = (points: Point[], expectedRadius: number, tolerance = 0.1) => {
    // Check that points form a reasonable approximation of a circle
    const distances = points.map(p => Math.sqrt(p.x * p.x + p.y * p.y));
    const avgRadius = distances.reduce((sum, d) => sum + d, 0) / distances.length;

    expect(Math.abs(avgRadius - expectedRadius)).toBeLessThan(tolerance);

    // Check that we have points distributed around the circle
    const angles = points.map(p => Math.atan2(p.y, p.x));
    const sortedAngles = [...angles].sort((a, b) => a - b);

    // Find gaps in angles to check distribution
    let maxGap = 0;
    for (let i = 0; i < sortedAngles.length; i++) {
      const current = sortedAngles[i];
      const next = sortedAngles[(i + 1) % sortedAngles.length];
      let gap = next - current;
      if (gap < 0) gap += 2 * Math.PI; // Wrap around
      maxGap = Math.max(maxGap, gap);
    }

    // Maximum gap should be reasonable (not too large)
    expect(maxGap).toBeLessThan(Math.PI / 2); // Less than 90 degrees gap
  };

  describe('Circle |z| = 1', () => {
    test('should draw as single component', () => {
      const parseResult = parser.parseExpressionString('|z| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z| = 1');

      expect(plotData).toBeDefined();
      expect(plotData.regions).toHaveLength(1);

      const region = plotData.regions[0];
      expectCurveComponent(region.boundary, 1);
    });

    test('should have points satisfying the equation', () => {
      const parseResult = parser.parseExpressionString('|z| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z| = 1');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      expect(boundaryPoints.length).toBeGreaterThan(10); // Should have sufficient points
      expectPointsOnCurve(boundaryPoints, '|z| - 1', 0.05); // Test against zero form
    });

    test('should form a circle shape with radius 1', () => {
      const parseResult = parser.parseExpressionString('|z| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z| = 1');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      expectCircleShape(boundaryPoints, 1.0, 0.1);
    });

    test('should be consistent across multiple runs', () => {
      const parseResult = parser.parseExpressionString('|z| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData1 = plotter.plotExpression(parseResult.ast, '|z| = 1');
      const plotData2 = plotter.plotExpression(parseResult.ast, '|z| = 1');

      const points1 = Array.isArray(plotData1.regions[0].boundary[0])
        ? plotData1.regions[0].boundary.flat().length
        : (plotData1.regions[0].boundary as Point[]).length;

      const points2 = Array.isArray(plotData2.regions[0].boundary[0])
        ? plotData2.regions[0].boundary.flat().length
        : (plotData2.regions[0].boundary as Point[]).length;

      expect(points1).toBe(points2);
    });
  });

  describe('Circle |z| = 2', () => {
    test('should draw as single component with radius 2', () => {
      const parseResult = parser.parseExpressionString('|z| = 2');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z| = 2');

      expect(plotData.regions).toHaveLength(1);
      const region = plotData.regions[0];
      expectCurveComponent(region.boundary, 1);

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      expectCircleShape(boundaryPoints, 2.0, 0.15);
    });

    test('should have points satisfying |z| = 2', () => {
      const parseResult = parser.parseExpressionString('|z| = 2');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z| = 2');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      expectPointsOnCurve(boundaryPoints, '|z| - 2', 0.08);
    });
  });

  describe('Line Re(z) = 0', () => {
    test('should draw as one or more components', () => {
      const parseResult = parser.parseExpressionString('Re(z) = 0');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, 'Re(z) = 0');

      expect(plotData.regions).toHaveLength(1);
      const region = plotData.regions[0];
      expectCurveComponent(region.boundary, 1); // At least 1 component
    });

    test('should have points satisfying Re(z) = 0', () => {
      const parseResult = parser.parseExpressionString('Re(z) = 0');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, 'Re(z) = 0');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      // Check that points are approximately on the y-axis
      boundaryPoints.forEach(point => {
        expect(Math.abs(point.x)).toBeLessThan(0.1); // Should be close to x=0
      });
    });
  });

  describe('Line Im(z) = 0', () => {
    test('should draw as one or more components', () => {
      const parseResult = parser.parseExpressionString('Im(z) = 0');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, 'Im(z) = 0');

      expect(plotData.regions).toHaveLength(1);
      const region = plotData.regions[0];
      expectCurveComponent(region.boundary, 1); // At least 1 component
    });

    test('should have points satisfying Im(z) = 0', () => {
      const parseResult = parser.parseExpressionString('Im(z) = 0');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, 'Im(z) = 0');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      // Check that points are approximately on the x-axis
      boundaryPoints.forEach(point => {
        expect(Math.abs(point.y)).toBeLessThan(0.1); // Should be close to y=0
      });
    });
  });

  describe('Curve |z - 1| = 1 (circle centered at 1)', () => {
    test('should draw as single component', () => {
      const parseResult = parser.parseExpressionString('|z - 1| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z - 1| = 1');

      expect(plotData.regions).toHaveLength(1);
      const region = plotData.regions[0];
      expectCurveComponent(region.boundary, 1);
    });

    test('should have points satisfying |z - 1| = 1', () => {
      const parseResult = parser.parseExpressionString('|z - 1| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z - 1| = 1');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      expectPointsOnCurve(boundaryPoints, '|z - 1| - 1', 0.08);
    });

    test('should form a circle centered at (1, 0)', () => {
      const parseResult = parser.parseExpressionString('|z - 1| = 1');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z - 1| = 1');
      const region = plotData.regions[0];

      // Extract boundary points
      let boundaryPoints: Point[] = [];
      if (Array.isArray(region.boundary[0])) {
        boundaryPoints = region.boundary.flat();
      } else {
        boundaryPoints = region.boundary as Point[];
      }

      // Check that center is approximately at (1, 0)
      const centerX = boundaryPoints.reduce((sum, p) => sum + p.x, 0) / boundaryPoints.length;
      const centerY = boundaryPoints.reduce((sum, p) => sum + p.y, 0) / boundaryPoints.length;

      expect(Math.abs(centerX - 1)).toBeLessThan(0.2);
      expect(Math.abs(centerY - 0)).toBeLessThan(0.2);
    });
  });

  describe('Step Size Impact', () => {
    test('should work with different step sizes', () => {
      const parseResult = parser.parseExpressionString('|z| = 1');
      expect(parseResult.error).toBeUndefined();

      const configCoarse = { ...defaultConfig, stepSize: 0.2, maxSteps: 200 };
      const configFine = { ...defaultConfig, stepSize: 0.02, maxSteps: 2000 };

      const plotterCoarse = new HybridPlotter(configCoarse);
      const plotterFine = new HybridPlotter(configFine);

      const plotDataCoarse = plotterCoarse.plotExpression(parseResult.ast, '|z| = 1');
      const plotDataFine = plotterFine.plotExpression(parseResult.ast, '|z| = 1');

      // Both should produce valid regions
      expect(plotDataCoarse.regions.length).toBeGreaterThan(0);
      expect(plotDataFine.regions.length).toBeGreaterThan(0);

      // Extract boundary points for both
      let pointsCoarse: Point[] = [];
      let pointsFine: Point[] = [];

      if (Array.isArray(plotDataCoarse.regions[0].boundary[0])) {
        pointsCoarse = plotDataCoarse.regions[0].boundary.flat();
      } else {
        pointsCoarse = plotDataCoarse.regions[0].boundary as Point[];
      }

      if (Array.isArray(plotDataFine.regions[0].boundary[0])) {
        pointsFine = plotDataFine.regions[0].boundary.flat();
      } else {
        pointsFine = plotDataFine.regions[0].boundary as Point[];
      }

      // Both should have points and satisfy the equation
      expect(pointsCoarse.length).toBeGreaterThan(0);
      expect(pointsFine.length).toBeGreaterThan(0);

      expectPointsOnCurve(pointsCoarse, '|z| - 1', 0.08);
      expectPointsOnCurve(pointsFine, '|z| - 1', 0.03); // Finer should be more accurate
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid expressions gracefully', () => {
      const parseResult = parser.parseExpressionString('invalid@expression');
      expect(parseResult.error).toBeDefined();

      // If parsing fails, plotting should also handle it gracefully
      if (!parseResult.error) {
        const plotData = plotter.plotExpression(parseResult.ast, 'invalid_expression');
        expect(plotData).toBeDefined();
        expect(plotData.regions).toHaveLength(0);
      }
    });

    test('should handle impossible expressions', () => {
      const parseResult = parser.parseExpressionString('1 = 2');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '1 = 2');

      expect(plotData).toBeDefined();
      // 1 = 2 has no solutions, so should be empty or have no valid regions
      if (plotData.regions.length > 0) {
        // If regions are created, they should be empty
        plotData.regions.forEach(region => {
          const boundaryPoints = Array.isArray(region.boundary[0])
            ? region.boundary.flat()
            : region.boundary as Point[];
          expect(boundaryPoints.length).toBe(0);
        });
      }
    });
  });

  describe('Complex Expressions', () => {
    test('should handle |z^2 + 1| = 2', () => {
      const parseResult = parser.parseExpressionString('|z^2 + 1| = 2');
      expect(parseResult.error).toBeUndefined();

      const plotData = plotter.plotExpression(parseResult.ast, '|z^2 + 1| = 2');

      expect(plotData).toBeDefined();

      // This should produce a curve (possibly multiple components)
      if (plotData.regions.length > 0) {
        const region = plotData.regions[0];

        // Extract boundary points
        let boundaryPoints: Point[] = [];
        if (Array.isArray(region.boundary[0])) {
          boundaryPoints = region.boundary.flat();
        } else {
          boundaryPoints = region.boundary as Point[];
        }

        if (boundaryPoints.length > 0) {
          expectPointsOnCurve(boundaryPoints, '|z^2 + 1| - 2', 0.1);
        }
      }
    });
  });
});
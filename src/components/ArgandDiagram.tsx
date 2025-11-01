import { useState, useMemo } from 'react';
import { Point, Curve, Inequality, PlotElement, PlotConfig } from '../types/complex';
import { PlotRegion } from '../math/plotting';

interface ArgandDiagramProps {
  elements: PlotElement[];
  plotData?: { regions: PlotRegion[] };
  width?: number;
  height?: number;
  range?: number;
  config?: PlotConfig;
}

const ArgandDiagram: React.FC<ArgandDiagramProps> = ({
  elements,
  plotData,
  width = 700,
  height = 700,
  range = 15,
  config: _
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  const scale = width / (2 * range);
  const center = width / 2;

  const toScreenCoords = (x: number, y: number) => ({
    x: center + x * scale,
    y: center - y * scale // Flip y-axis for screen coordinates
  });

  
  const gridLines = useMemo(() => {
    const lines = [];

    // Vertical lines
    for (let i = -range; i <= range; i++) {
      const screenX = toScreenCoords(i, 0).x;
      lines.push(
        <line
          key={`v-${i}`}
          x1={screenX}
          y1={0}
          x2={screenX}
          y2={height}
          stroke={i === 0 ? '#333' : '#e0e0e0'}
          strokeWidth={i === 0 ? 2 : 1}
        />
      );

      // X-axis labels
      if (i !== 0) {
        lines.push(
          <text
            key={`vx-${i}`}
            x={screenX}
            y={center + 15}
            textAnchor="middle"
            fontSize="12"
            fill="#666"
          >
            {i}
          </text>
        );
      }
    }

    // Horizontal lines
    for (let i = -range; i <= range; i++) {
      const screenY = toScreenCoords(0, i).y;
      lines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={screenY}
          x2={width}
          y2={screenY}
          stroke={i === 0 ? '#333' : '#e0e0e0'}
          strokeWidth={i === 0 ? 2 : 1}
        />
      );

      // Y-axis labels
      if (i !== 0) {
        lines.push(
          <text
            key={`hy-${i}`}
            x={center - 15}
            y={screenY + 5}
            textAnchor="middle"
            fontSize="12"
            fill="#666"
          >
            {i}i
          </text>
        );
      }
    }

    return lines;
  }, [width, height, range, scale, center]);

  const renderPoint = (point: Point, index: number) => {
    const screen = toScreenCoords(point.x, point.y);
    return (
      <g key={`point-${index}`}>
        <circle
          cx={screen.x}
          cy={screen.y}
          r="5"
          fill={point.color || '#ff6b6b'}
          stroke="#fff"
          strokeWidth="2"
          onMouseEnter={() => setHoveredPoint(point)}
          onMouseLeave={() => setHoveredPoint(null)}
          style={{ cursor: 'pointer' }}
        />
        {point.label && (
          <text
            x={screen.x + 10}
            y={screen.y - 10}
            fontSize="14"
            fill="#333"
          >
            {point.label}
          </text>
        )}
      </g>
    );
  };

  const renderCurve = (curve: Curve, index: number) => {
    const pathData = curve.points
      .map((point, pointIndex) => {
        const screen = toScreenCoords(point.x, point.y);
        return `${pointIndex === 0 ? 'M' : 'L'} ${screen.x} ${screen.y}`;
      })
      .join(' ');

    return (
      <g key={`curve-${index}`}>
        <path
          d={pathData}
          fill="none"
          stroke={curve.color || '#4ecdc4'}
          strokeWidth="2"
        />
        {curve.label && curve.points.length > 0 && (
          <text
            x={toScreenCoords(curve.points[curve.points.length - 1].x, curve.points[curve.points.length - 1].y).x + 10}
            y={toScreenCoords(curve.points[curve.points.length - 1].x, curve.points[curve.points.length - 1].y).y - 10}
            fontSize="14"
            fill="#333"
          >
            {curve.label}
          </text>
        )}
      </g>
    );
  };

  const renderInequality = (inequality: Inequality, index: number) => {
    const { type, center, radius, boundary = 'solid', color = '#95e77e' } = inequality;

    if (!center || radius === undefined) return null;

    const screen = toScreenCoords(center.real, center.imaginary);
    const screenRadius = radius * scale;

    if (type === 'circle') {
      return (
        <g key={`inequality-${index}`}>
          <circle
            cx={screen.x}
            cy={screen.y}
            r={screenRadius}
            fill={color}
            fillOpacity={0.3}
            stroke={color}
            strokeWidth="2"
            strokeDasharray={boundary === 'dashed' ? '5,5' : '0'}
          />
          {inequality.label && (
            <text
              x={screen.x + screenRadius + 10}
              y={screen.y}
              fontSize="14"
              fill="#333"
            >
              {inequality.label}
            </text>
          )}
        </g>
      );
    }

    return null;
  };

  const renderPlotRegion = (region: PlotRegion, index: number) => {
    const { points, boundary, type, color = '#4ecdc4' } = region;

    const elements = [];

    // Render filled region using individual points for better control
    if ((type === 'filled' || type === 'both') && points.length > 0) {
      // Create small circles or squares for each point to avoid polygon artifacts
      points.forEach((point, pointIndex) => {
        const screen = toScreenCoords(point.x, point.y);
        elements.push(
          <circle
            key={`region-point-${index}-${pointIndex}`}
            cx={screen.x}
            cy={screen.y}
            r="1.5"
            fill={color}
            fillOpacity={0.4}
          />
        );
      });
    }

    // Render boundary if type includes boundary or boundary exists
    if (((type === 'boundary' || type === 'both') && boundary.length > 0)) {
      // Check if boundary is array of curves (multiple disconnected curves)
      if (Array.isArray(boundary[0])) {
        // Multiple separate curves - render each as its own path
        (boundary as Point[][]).forEach((curve, curveIndex) => {
          if (curve.length > 0) {
            const pathData = curve
              .map((point, i) => {
                const screen = toScreenCoords(point.x, point.y);
                return `${i === 0 ? 'M' : 'L'} ${screen.x} ${screen.y}`;
              })
              .join(' ');

            elements.push(
              <path
                key={`region-boundary-${index}-curve-${curveIndex}`}
                d={pathData}
                fill="none"
                stroke={color}
                strokeWidth="2"
              />
            );
          }
        });
      } else {
        // Single curve - render as one path (backward compatibility)
        const pathData = (boundary as Point[])
          .map((point, i) => {
            const screen = toScreenCoords(point.x, point.y);
            return `${i === 0 ? 'M' : 'L'} ${screen.x} ${screen.y}`;
          })
          .join(' ');

        elements.push(
          <path
            key={`region-boundary-${index}`}
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
        );
      }
    }

    // Add label if available from expression
    if (region.expression) {
      const bounds = calculateRegionBounds(region);
      if (bounds) {
        const screen = toScreenCoords(bounds.centerX, bounds.centerY);
        elements.push(
          <text
            key={`region-label-${index}`}
            x={screen.x}
            y={screen.y}
            fontSize="12"
            fill={color}
            textAnchor="middle"
            className="pointer-events-none"
          >
            {region.expression.length > 15
              ? region.expression.substring(0, 12) + '...'
              : region.expression}
          </text>
        );
      }
    }

    return (
      <g key={`plot-region-${index}`}>
        {elements}
      </g>
    );
  };

  const calculateRegionBounds = (region: PlotRegion) => {
    let allPoints = [...region.points];

    // Handle both single boundary and multiple boundary curves
    if (Array.isArray(region.boundary[0])) {
      // Multiple curves
      (region.boundary as Point[][]).forEach(curve => {
        allPoints = [...allPoints, ...curve];
      });
    } else {
      // Single curve
      allPoints = [...allPoints, ...(region.boundary as Point[])];
    }

    if (allPoints.length === 0) return null;

    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y));
    const maxY = Math.max(...allPoints.map(p => p.y));

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  return (
    <div className="argand-diagram">
      <svg width={width} height={height} className="border border-gray-300">
        {gridLines}

        {/* Render plot regions from expressions first (background) */}
        {plotData?.regions.map((region, index) =>
          renderPlotRegion(region, index)
        )}

        {/* Render traditional elements */}
        {elements.map((element, index) => {
          if ('points' in element && Array.isArray(element.points)) {
            return renderCurve(element as Curve, index);
          } else if ('x' in element && 'y' in element) {
            return renderPoint(element as Point, index);
          } else if ('type' in element) {
            return renderInequality(element as Inequality, index);
          }
          return null;
        })}

        {/* Axes labels */}
        <text x={width - 20} y={center - 5} fontSize="14" fill="#333">Re</text>
        <text x={center + 5} y={20} fontSize="14" fill="#333">Im</text>
      </svg>

      {hoveredPoint && (
        <div className="absolute bg-white border border-gray-300 rounded p-2 shadow-lg">
          <div>x: {hoveredPoint.x.toFixed(2)}</div>
          <div>y: {hoveredPoint.y.toFixed(2)}i</div>
          {hoveredPoint.label && <div>Label: {hoveredPoint.label}</div>}
        </div>
      )}
    </div>
  );
};

export default ArgandDiagram;
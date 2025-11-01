import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Point, Curve, Inequality, PlotElement, PlotConfig } from '../types/complex';
import { PlotRegion } from '../math/plotting';

interface ViewportState {
  offsetX: number;
  offsetY: number;
  zoomLevel: number;
}

interface ArgandDiagramProps {
  elements: PlotElement[];
  plotData?: { regions: PlotRegion[] };
  width?: number;
  height?: number;
  range?: number;
  config?: PlotConfig;
  onViewportChange?: (viewport: ViewportState) => void;
}

const ArgandDiagram: React.FC<ArgandDiagramProps> = ({
  elements,
  plotData,
  width = 700,
  height = 700,
  range = 15,
  config: _,
  onViewportChange
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [viewport, setViewport] = useState<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    zoomLevel: 1
  });

  // Wrapper to call onViewportChange when viewport changes
  const updateViewport = useCallback((newViewport: ViewportState | ((prev: ViewportState) => ViewportState)) => {
    const updatedViewport = typeof newViewport === 'function' ? newViewport(viewport) : newViewport;
    setViewport(updatedViewport);
    if (onViewportChange) {
      onViewportChange(updatedViewport);
    }
  }, [onViewportChange, viewport]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const baseScale = width / (2 * range);
  const scale = baseScale * viewport.zoomLevel;
  const center = { x: width / 2, y: height / 2 };

  const toScreenCoords = (x: number, y: number) => ({
    x: center.x + (x - viewport.offsetX) * scale,
    y: center.y - (y - viewport.offsetY) * scale // Flip y-axis for screen coordinates
  });

  const toMathCoords = (screenX: number, screenY: number) => ({
    x: (screenX - center.x) / scale + viewport.offsetX,
    y: -(screenY - center.y) / scale + viewport.offsetY // Flip y-axis for math coordinates
  });

  // Mouse event handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0) { // Left mouse button only
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;

    // Convert pixel delta to math coordinate delta
    const mathDeltaX = -deltaX / scale;
    const mathDeltaY = deltaY / scale; // Inverted because y-axis is flipped

    updateViewport(prev => ({
      ...prev,
      offsetX: prev.offsetX + mathDeltaX,
      offsetY: prev.offsetY + mathDeltaY
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Wheel event handler for zooming
  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();

    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoomLevel = Math.max(0.1, Math.min(50, viewport.zoomLevel * scaleFactor));

    if (newZoomLevel === viewport.zoomLevel) return;

    // Get mouse position in math coordinates before zoom
    const mouseScreenCoords = { x: e.clientX, y: e.clientY };
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const mouseX = mouseScreenCoords.x - svgRect.left;
    const mouseY = mouseScreenCoords.y - svgRect.top;
    const mathCoords = toMathCoords(mouseX, mouseY);

    // Update zoom
    updateViewport(prev => {
      const newViewport = { ...prev, zoomLevel: newZoomLevel };

      // Calculate new scale
      const newScale = baseScale * newZoomLevel;

      // Adjust offset to zoom toward mouse position
      const zoomFactor = newZoomLevel / prev.zoomLevel;
      newViewport.offsetX = mathCoords.x - (mathCoords.x - prev.offsetX) * zoomFactor;
      newViewport.offsetY = mathCoords.y - (mathCoords.y - prev.offsetY) * zoomFactor;

      return newViewport;
    });
  }, [viewport.zoomLevel, baseScale, toMathCoords]);

  // Keyboard shortcuts (only when SVG is focused or with Ctrl/Cmd)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keyboard shortcuts if:
    // 1. The SVG element is focused, OR
    // 2. Ctrl/Cmd key is pressed (for global shortcuts)
    if (!svgRef.current ||
        (document.activeElement !== svgRef.current && !e.ctrlKey && !e.metaKey)) {
      return;
    }

    const step = 0.5 / viewport.zoomLevel; // Pan step size
    let newViewport = { ...viewport };

    switch (e.key) {
      case 'ArrowUp':
        newViewport.offsetY += step;
        break;
      case 'ArrowDown':
        newViewport.offsetY -= step;
        break;
      case 'ArrowLeft':
        newViewport.offsetX -= step;
        break;
      case 'ArrowRight':
        newViewport.offsetX += step;
        break;
      case '+':
      case '=':
        if (e.ctrlKey || e.metaKey) {
          newViewport.zoomLevel = Math.min(50, newViewport.zoomLevel * 1.2);
        }
        break;
      case '-':
        if (e.ctrlKey || e.metaKey) {
          newViewport.zoomLevel = Math.max(0.1, newViewport.zoomLevel * 0.8);
        }
        break;
      case 'r':
      case 'R':
        if (e.ctrlKey || e.metaKey || document.activeElement === svgRef.current) {
          // Reset view
          newViewport = { offsetX: 0, offsetY: 0, zoomLevel: 1 };
        }
        break;
      default:
        return;
    }

    updateViewport(newViewport);
    if (e.key !== 'r' && e.key !== 'R') {
      e.preventDefault();
    }
  }, [viewport]);

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Helper functions for external control
  const resetView = useCallback(() => {
    updateViewport({ offsetX: 0, offsetY: 0, zoomLevel: 1 });
  }, []);

  const zoomIn = useCallback(() => {
    updateViewport(prev => ({ ...prev, zoomLevel: Math.min(50, prev.zoomLevel * 1.2) }));
  }, []);

  const zoomOut = useCallback(() => {
    updateViewport(prev => ({ ...prev, zoomLevel: Math.max(0.1, prev.zoomLevel * 0.8) }));
  }, []);


  const gridLines = useMemo(() => {
    const lines = [];

    // Calculate visible range in math coordinates
    const topLeft = toMathCoords(0, 0);
    const bottomRight = toMathCoords(width, height);

    // Calculate grid step size based on zoom level
    const baseStep = 1;
    let stepSize = baseStep;

    // Adjust step size for zoom levels
    if (viewport.zoomLevel < 0.5) {
      stepSize = 5;
    } else if (viewport.zoomLevel < 0.2) {
      stepSize = 10;
    } else if (viewport.zoomLevel > 5) {
      stepSize = 0.5;
    } else if (viewport.zoomLevel > 10) {
      stepSize = 0.25;
    }

    // Calculate grid bounds with some padding
    const padding = stepSize * 2;
    const minX = Math.floor((Math.min(topLeft.x, bottomRight.x) - padding) / stepSize) * stepSize;
    const maxX = Math.ceil((Math.max(topLeft.x, bottomRight.x) + padding) / stepSize) * stepSize;
    const minY = Math.floor((Math.min(topLeft.y, bottomRight.y) - padding) / stepSize) * stepSize;
    const maxY = Math.ceil((Math.max(topLeft.y, bottomRight.y) + padding) / stepSize) * stepSize;

    // Ensure origin (0,0) is always included
    const finalMinX = Math.min(minX, 0);
    const finalMaxX = Math.max(maxX, 0);
    const finalMinY = Math.min(minY, 0);
    const finalMaxY = Math.max(maxY, 0);

    // Vertical lines
    for (let x = finalMinX; x <= finalMaxX; x += stepSize) {
      const screenX = toScreenCoords(x, 0).x;

      // Only draw lines that are visible
      if (screenX >= -50 && screenX <= width + 50) {
        const isMainAxis = Math.abs(x) < stepSize / 1000; // Use very small tolerance for origin
        lines.push(
          <line
            key={`v-${x}`}
            x1={screenX}
            y1={0}
            x2={screenX}
            y2={height}
            stroke={isMainAxis ? '#333' : '#e0e0e0'}
            strokeWidth={isMainAxis ? 2 : 1}
          />
        );

        // X-axis labels (skip origin since we have dynamic labels)
        if (!isMainAxis && Math.abs(x) >= stepSize / 2) {
          const labelValue = x.toFixed(stepSize < 1 ? 1 : 0);
          const originScreen = toScreenCoords(0, 0);

          // Position label relative to axis, but keep in bounds
          const labelY = Math.min(height - 5, Math.max(15, originScreen.y + 15));
          const labelX = screenX;

          lines.push(
            <text
              key={`vx-${x}`}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize="12"
              fill="#666"
              className="pointer-events-none"
            >
              {labelValue}
            </text>
          );
        }
      }
    }

    // Horizontal lines
    for (let y = finalMinY; y <= finalMaxY; y += stepSize) {
      const screenY = toScreenCoords(0, y).y;

      // Only draw lines that are visible
      if (screenY >= -50 && screenY <= height + 50) {
        const isMainAxis = Math.abs(y) < stepSize / 1000; // Use very small tolerance for origin
        lines.push(
          <line
            key={`h-${y}`}
            x1={0}
            y1={screenY}
            x2={width}
            y2={screenY}
            stroke={isMainAxis ? '#333' : '#e0e0e0'}
            strokeWidth={isMainAxis ? 2 : 1}
          />
        );

        // Y-axis labels (skip origin since we have dynamic labels)
        if (!isMainAxis && Math.abs(y) >= stepSize / 2) {
          const labelValue = y.toFixed(stepSize < 1 ? 1 : 0);
          const originScreen = toScreenCoords(0, 0);

          // Position label relative to axis, but keep in bounds
          const labelX = Math.min(width - 5, Math.max(20, originScreen.x - 20));
          const labelY = screenY + 5;

          lines.push(
            <text
              key={`hy-${y}`}
              x={labelX}
              y={labelY}
              textAnchor="middle"
              fontSize="12"
              fill="#666"
              className="pointer-events-none"
            >
              {labelValue}i
            </text>
          );
        }
      }
    }

    return lines;
  }, [width, height, scale, center, viewport, toMathCoords, toScreenCoords]);

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
    <div className="argand-diagram relative">
      {/* Controls overlay */}
      <div className="absolute top-2 right-2 bg-white bg-opacity-90 rounded shadow-md p-2 z-10">
        <div className="text-xs font-mono text-gray-600 mb-2">
          Zoom: {(viewport.zoomLevel * 100).toFixed(0)}%
        </div>
        <div className="flex gap-1">
          <button
            onClick={zoomIn}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Zoom In (+)"
          >
            +
          </button>
          <button
            onClick={zoomOut}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            title="Zoom Out (-)"
          >
            −
          </button>
          <button
            onClick={resetView}
            className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
            title="Reset View (R)"
          >
            ↺
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-2">
          <div>Drag to pan</div>
          <div>Scroll to zoom</div>
          <div>Click diagram + arrows to pan</div>
          <div>Ctrl+/- to zoom</div>
          <div>Ctrl+R to reset</div>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onClick={() => svgRef.current?.focus()}
      >
        {gridLines}

        {/* Dynamic axes that move with viewport */}
        <line
          x1="0"
          y1={toScreenCoords(0, 0).y}
          x2={width}
          y2={toScreenCoords(0, 0).y}
          stroke="#333"
          strokeWidth="2"
        />
        <line
          x1={toScreenCoords(0, 0).x}
          y1="0"
          x2={toScreenCoords(0, 0).x}
          y2={height}
          stroke="#333"
          strokeWidth="2"
        />

        {/* Dynamic axis labels that stay in bounds */}
        <text
          x={Math.min(width - 20, Math.max(20, toScreenCoords(0, 0).x + 20))}
          y={Math.min(height - 5, Math.max(15, toScreenCoords(0, 0).y - 5))}
          fontSize="14"
          fill="#333"
          className="pointer-events-none"
        >
          Re
        </text>
        <text
          x={Math.min(width - 5, Math.max(5, toScreenCoords(0, 0).x + 5))}
          y={Math.min(height - 5, Math.max(15, toScreenCoords(0, 0).y - 15))}
          fontSize="14"
          fill="#333"
          className="pointer-events-none"
        >
          Im
        </text>

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
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
  tickCrowding?: number;
  onTickCrowdingChange?: (tickCrowding: number) => void;
}

const ArgandDiagram: React.FC<ArgandDiagramProps> = ({
  elements,
  plotData,
  width = 700,
  height = 700,
  range = 15,
  config,
  onViewportChange,
  tickCrowding,
  onTickCrowdingChange
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
    const tickSize = config?.tickSize || 6;

    // Calculate visible range in math coordinates
    const topLeft = toMathCoords(0, 0);
    const bottomRight = toMathCoords(width, height);

    // Calculate step size based on crowding level and zoom
    const calculateOptimalStepSize = (crowding: number, zoom: number): number => {
      // Base step sizes for different crowding levels at zoom 1
      const baseSteps = [5, 2, 1, 0.5, 0.25]; // 1=very sparse, 5=very dense

      // Get base step for crowding level (ensure it's within bounds)
      const crowdingIndex = Math.max(0, Math.min(4, crowding - 1));
      let stepSize = baseSteps[crowdingIndex];

      // Adjust for zoom level
      if (zoom < 0.2) {
        stepSize *= 20; // Very zoomed out - much larger steps
      } else if (zoom < 0.5) {
        stepSize *= 5; // Zoomed out - larger steps
      } else if (zoom < 1) {
        stepSize *= 2; // Slightly zoomed out
      } else if (zoom > 10) {
        stepSize *= 0.1; // Very zoomed in - much smaller steps
      } else if (zoom > 5) {
        stepSize *= 0.25; // Zoomed in - smaller steps
      } else if (zoom > 2) {
        stepSize *= 0.5; // Slightly zoomed in
      }

      // Round to nice numbers
      const magnitude = Math.pow(10, Math.floor(Math.log10(stepSize)));
      const normalized = stepSize / magnitude;

      let niceNormalized;
      if (normalized <= 1) niceNormalized = 1;
      else if (normalized <= 2) niceNormalized = 2;
      else if (normalized <= 5) niceNormalized = 5;
      else niceNormalized = 10;

      return niceNormalized * magnitude;
    };

    const stepSize = tickCrowding !== undefined
      ? calculateOptimalStepSize(tickCrowding, viewport.zoomLevel)
      : calculateOptimalStepSize(2, viewport.zoomLevel); // Default medium crowding

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

    // Vertical grid lines only (no axes, ticks, or labels)
    for (let x = finalMinX; x <= finalMaxX; x += stepSize) {
      const screenX = toScreenCoords(x, 0).x;

      // Only draw lines that are visible
      if (screenX >= -50 && screenX <= width + 50) {
        const isMainAxis = Math.abs(x) < stepSize / 1000; // Use very small tolerance for origin

        // Skip main axis lines (they'll be drawn separately)
        if (!isMainAxis) {
          lines.push(
            <line
              key={`v-${x}`}
              x1={screenX}
              y1={0}
              x2={screenX}
              y2={height}
              className="diagram-grid-line"
              strokeWidth="1"
            />
          );
        }
      }
    }

    // Horizontal grid lines only (no axes, ticks, or labels)
    for (let y = finalMinY; y <= finalMaxY; y += stepSize) {
      const screenY = toScreenCoords(0, y).y;

      // Only draw lines that are visible
      if (screenY >= -50 && screenY <= height + 50) {
        const isMainAxis = Math.abs(y) < stepSize / 1000; // Use very small tolerance for origin

        // Skip main axis lines (they'll be drawn separately)
        if (!isMainAxis) {
          lines.push(
            <line
              key={`h-${y}`}
              x1={0}
              y1={screenY}
              x2={width}
              y2={screenY}
              className="diagram-grid-line"
              strokeWidth="1"
            />
          );
        }
      }
    }

    return lines;
  }, [width, height, scale, center, viewport, toMathCoords, toScreenCoords, tickCrowding]);

  const tickMarks = useMemo(() => {
    const ticks = [];
    const tickSize = config?.tickSize || 6;

    // Calculate visible range in math coordinates (reuse from gridLines)
    const topLeft = toMathCoords(0, 0);
    const bottomRight = toMathCoords(width, height);

    // Calculate step size based on crowding level and zoom
    const calculateOptimalStepSize = (crowding: number, zoom: number): number => {
      const baseSteps = [5, 2, 1, 0.5, 0.25];
      const crowdingIndex = Math.max(0, Math.min(4, crowding - 1));
      let stepSize = baseSteps[crowdingIndex];

      if (zoom < 0.2) {
        stepSize *= 20;
      } else if (zoom < 0.5) {
        stepSize *= 5;
      } else if (zoom < 1) {
        stepSize *= 2;
      } else if (zoom > 10) {
        stepSize *= 0.1;
      } else if (zoom > 5) {
        stepSize *= 0.25;
      } else if (zoom > 2) {
        stepSize *= 0.5;
      }

      const magnitude = Math.pow(10, Math.floor(Math.log10(stepSize)));
      const normalized = stepSize / magnitude;

      let niceNormalized;
      if (normalized <= 1) niceNormalized = 1;
      else if (normalized <= 2) niceNormalized = 2;
      else if (normalized <= 5) niceNormalized = 5;
      else niceNormalized = 10;

      return niceNormalized * magnitude;
    };

    const stepSize = tickCrowding !== undefined
      ? calculateOptimalStepSize(tickCrowding, viewport.zoomLevel)
      : calculateOptimalStepSize(2, viewport.zoomLevel);

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

    // Vertical lines - add tick marks and labels on main axis
    for (let x = finalMinX; x <= finalMaxX; x += stepSize) {
      const screenX = toScreenCoords(x, 0).x;

      // Only draw ticks that are visible
      if (screenX >= -50 && screenX <= width + 50) {
        const isMainAxis = Math.abs(x) < stepSize / 1000;

        // Add tick marks on x-axis for main axis line
        if (isMainAxis) {
          const xAxisY = toScreenCoords(0, 0).y;

          // Add tick marks at regular intervals
          const tickStep = stepSize;
          for (let tickX = finalMinX; tickX <= finalMaxX; tickX += tickStep) {
            if (Math.abs(tickX) >= tickStep / 2) { // Skip origin
              const tickScreenX = toScreenCoords(tickX, 0).x;
              ticks.push(
                <line
                  key={`tick-x-${tickX}`}
                  x1={tickScreenX}
                  y1={xAxisY - tickSize / 2}
                  x2={tickScreenX}
                  y2={xAxisY + tickSize / 2}
                  className="diagram-axis"
                  strokeWidth="2"
                />
              );
            }
          }
        }

        // X-axis labels (skip origin since we have dynamic labels)
        if (!isMainAxis && Math.abs(x) >= stepSize / 2) {
          const labelValue = x.toFixed(stepSize < 1 ? 1 : 0);

          // Position label relative to axis line position, avoiding ticks
          const xAxisY = toScreenCoords(0, 0).y; // Y position of x-axis
          const labelY = Math.min(height - 5, Math.max(15, xAxisY + tickSize + 10));
          const labelX = screenX;

          // Check for collision with "Re" axis label
          const reLabelX = width - 30;
          const reLabelY = toScreenCoords(0, 0).y + tickSize + 15;
          const labelWidth = 25; // Approximate width of axis label
          const labelHeight = 20; // Approximate height of axis label
          const tickLabelWidth = 30; // Approximate width of tick label
          const tickLabelHeight = 15; // Approximate height of tick label

          // Check if tick label would overlap with axis label
          const wouldOverlapRe =
            Math.abs(labelX - reLabelX) < (tickLabelWidth + labelWidth) / 2 &&
            Math.abs(labelY - reLabelY) < (tickLabelHeight + labelHeight) / 2;

          if (!wouldOverlapRe) {
            ticks.push(
              <text
                key={`vx-${x}`}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                fontSize="12"
                className="diagram-text-secondary pointer-events-none"
              >
                {labelValue}
              </text>
            );
          }
        }
      }
    }

    // Horizontal lines - add tick marks and labels on main axis
    for (let y = finalMinY; y <= finalMaxY; y += stepSize) {
      const screenY = toScreenCoords(0, y).y;

      // Only draw ticks that are visible
      if (screenY >= -50 && screenY <= height + 50) {
        const isMainAxis = Math.abs(y) < stepSize / 1000;

        // Add tick marks on y-axis for main axis line
        if (isMainAxis) {
          const yAxisX = toScreenCoords(0, 0).x;

          // Add tick marks at regular intervals
          const tickStep = stepSize;
          for (let tickY = finalMinY; tickY <= finalMaxY; tickY += tickStep) {
            if (Math.abs(tickY) >= tickStep / 2) { // Skip origin
              const tickScreenY = toScreenCoords(0, tickY).y;
              ticks.push(
                <line
                  key={`tick-y-${tickY}`}
                  x1={yAxisX - tickSize / 2}
                  y1={tickScreenY}
                  x2={yAxisX + tickSize / 2}
                  y2={tickScreenY}
                  className="diagram-axis"
                  strokeWidth="2"
                />
              );
            }
          }
        }

        // Y-axis labels (skip origin since we have dynamic labels)
        if (!isMainAxis && Math.abs(y) >= stepSize / 2) {
          const labelValue = y.toFixed(stepSize < 1 ? 1 : 0);

          // Position label relative to axis line position, avoiding ticks
          const yAxisX = toScreenCoords(0, 0).x; // X position of y-axis
          const labelX = Math.min(width - 5, Math.max(tickSize + 15, yAxisX - tickSize - 10));
          const labelY = screenY + 5;

          // Check for collision with "Im" axis label - only hide if very close to top
          const imLabelY = 15;
          const verticalThreshold = 15; // Hide labels if they're within 15px of the Im label

          // Only check vertical distance since Im label is at top center
          const wouldOverlapIm = Math.abs(labelY - imLabelY) < verticalThreshold;

          if (!wouldOverlapIm) {
            ticks.push(
              <text
                key={`hy-${y}`}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                fontSize="12"
                className="diagram-text-secondary pointer-events-none"
              >
                {labelValue}i
              </text>
            );
          }
        }
      }
    }

    return ticks;
  }, [width, height, scale, center, viewport, toMathCoords, toScreenCoords, config?.tickSize, tickCrowding]);

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
            className="diagram-text-primary"
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
            className="diagram-text-primary"
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
              className="diagram-text-primary"
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

  // Define tickSize for line length (fixed)
  const tickSize = config?.tickSize || 6;

  return (
    <div className="argand-diagram relative">
      {/* Controls overlay */}
      <div className="absolute top-2 right-2 diagram-control-panel rounded shadow-md p-2 z-10">
        <div className="text-xs font-mono diagram-control-text mb-2">
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
        {onTickCrowdingChange && (
          <div className="mt-3 pt-2 border-t diagram-control-border">
            <div className="text-xs font-mono diagram-control-text mb-1">
              Tick Density: {['Very Sparse', 'Sparse', 'Medium', 'Dense', 'Very Dense'][tickCrowding - 1]}
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => onTickCrowdingChange(Math.max(1, tickCrowding - 1))}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="Less crowded"
                disabled={tickCrowding <= 1}
              >
                −
              </button>
              <button
                onClick={() => onTickCrowdingChange(Math.min(5, tickCrowding + 1))}
                className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                title="More crowded"
                disabled={tickCrowding >= 5}
              >
                +
              </button>
            </div>
          </div>
        )}
        <div className="text-xs diagram-control-text mt-2">
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
        className="border diagram-svg-border focus:outline-none focus:ring-2 focus:ring-blue-400"
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
        {tickMarks}

        {/* Dynamic axes that move with viewport */}
        <line
          x1="0"
          y1={toScreenCoords(0, 0).y}
          x2={width}
          y2={toScreenCoords(0, 0).y}
          className="diagram-axis"
          strokeWidth="2"
        />
        <line
          x1={toScreenCoords(0, 0).x}
          y1="0"
          x2={toScreenCoords(0, 0).x}
          y2={height}
          className="diagram-axis"
          strokeWidth="2"
        />

        {/* Fixed axis labels that stay at screen edges, avoiding ticks */}
        <text
          x={width - 30}
          y={Math.max(25, Math.min(height - 10, toScreenCoords(0, 0).y + tickSize + 15))}
          fontSize="14"
          className="diagram-text-primary pointer-events-none"
          textAnchor="middle"
        >
          Re
        </text>
        <text
          x={Math.max(30, Math.min(width - 30, toScreenCoords(0, 0).x - tickSize - 20))}
          y={20}
          fontSize="14"
          className="diagram-text-primary pointer-events-none"
          textAnchor="middle"
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
        <div className="absolute diagram-tooltip rounded p-2 shadow-lg">
          <div>x: {hoveredPoint.x.toFixed(2)}</div>
          <div>y: {hoveredPoint.y.toFixed(2)}i</div>
          {hoveredPoint.label && <div>Label: {hoveredPoint.label}</div>}
        </div>
      )}
    </div>
  );
};

export default ArgandDiagram;
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
  viewport?: ViewportState;
  onViewportChange?: (viewport: ViewportState) => void;
  tickCrowding?: number;
  onTickCrowdingChange?: (tickCrowding: number) => void;
  isControlsCollapsed?: boolean;
  onToggleControls?: () => void;
  showAllLabels?: boolean;
}

const ArgandDiagram: React.FC<ArgandDiagramProps> = ({
  elements,
  plotData,
  width = 700,
  height = 700,
  range = 15,
  config,
  viewport,
  onViewportChange,
  tickCrowding,
  onTickCrowdingChange,
  isControlsCollapsed = false,
  onToggleControls,
  showAllLabels = false
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<PlotRegion | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  // Cache for plot regions to display during panning
  const cachedPlotRegions = useRef<PlotRegion[]>([]);

  // Cache for label positions to prevent jumping during pan
  const labelPositionCache = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Default viewport if not provided
  const currentViewport = viewport || {
    offsetX: 0,
    offsetY: 0,
    zoomLevel: 0.66
  };

  // Wrapper to call onViewportChange when viewport changes
  const updateViewport = useCallback((newViewport: ViewportState) => {
    if (onViewportChange) {
      onViewportChange(newViewport);
    }
  }, [onViewportChange]);

  // Check if a point is inside a region
  const isPointInRegion = useCallback((x: number, y: number, region: PlotRegion): boolean => {
    // Check if point is in filled points
    if (region.points.length > 0) {
      for (const point of region.points) {
        const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
        if (distance < 0.3) { // Tolerance for point detection
          return true;
        }
      }
    }

    // Check if point is near boundary
    if (region.boundary.length > 0) {
      const checkBoundary = (boundary: Point[]) => {
        for (let i = 0; i < boundary.length - 1; i++) {
          const p1 = boundary[i];
          const p2 = boundary[i + 1];
          const distance = distanceToLineSegment(x, y, p1.x, p1.y, p2.x, p2.y);
          if (distance < 0.5) { // Tolerance for line detection
            return true;
          }
        }
        return false;
      };

      // Check if boundary is array of curves (multiple disconnected curves)
      if (Array.isArray(region.boundary[0])) {
        for (const curve of region.boundary as Point[][]) {
          if (checkBoundary(curve)) return true;
        }
      } else {
        if (checkBoundary(region.boundary as Point[])) return true;
      }
    }

    return false;
  }, []);

  // Calculate distance from point to line segment
  const distanceToLineSegment = useCallback((px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Debounced viewport update for performance during panning
  const viewportUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const baseScale = (width * 3) / (2 * range);
  const scale = baseScale * currentViewport.zoomLevel;
  const center = { x: width / 2, y: height / 2 };

  // Helper functions to convert between coordinate systems
  const toScreenCoords = useCallback((x: number, y: number) => {
    const screenX = center.x + (x - currentViewport.offsetX) * scale;
    const screenY = center.y - (y - currentViewport.offsetY) * scale; // Flip y-axis for math coordinates
    return { x: screenX, y: screenY };
  }, [center, scale, currentViewport]);

  const toMathCoords = useCallback((screenX: number, screenY: number) => {
    const x = (screenX - center.x) / scale + currentViewport.offsetX;
    const y = -(screenY - center.y) / scale + currentViewport.offsetY; // Flip y-axis for math coordinates
    return { x, y };
  }, [center, scale, currentViewport]);

  // Mouse event handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0) { // Left mouse button only
      setIsDragging(true);
      setIsPanning(true); // Start panning mode

      // Cache current plot regions for display during panning
      if (plotData?.regions) {
        cachedPlotRegions.current = [...plotData.regions];
      }

      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [plotData]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    const mathCoords = toMathCoords(mouseX, mouseY);

    // Check if hovering over any region (only when not dragging and not panning)
    if (plotData?.regions && !isDragging && !isPanning) {
      let foundHoveredRegion: PlotRegion | null = null;

      for (const region of plotData.regions) {
        if (isPointInRegion(mathCoords.x, mathCoords.y, region)) {
          foundHoveredRegion = region;
          break;
        }
      }

      setHoveredRegion(foundHoveredRegion);
    }

    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      // Convert pixel delta to math coordinate delta
      const mathDeltaX = -deltaX / scale;
      const mathDeltaY = deltaY / scale; // Inverted because y-axis is flipped

      const newViewport = {
        ...currentViewport,
        offsetX: currentViewport.offsetX + mathDeltaX,
        offsetY: currentViewport.offsetY + mathDeltaY
      };

      // Update viewport immediately for smooth panning
      updateViewport(newViewport);

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart, scale, currentViewport, updateViewport, plotData, toMathCoords]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    // Add a small delay before ending panning to prevent flicker
    setTimeout(() => {
      setIsPanning(false);
    }, 50);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
    setHoveredRegion(null);
    // End panning when mouse leaves the diagram
    setTimeout(() => {
      setIsPanning(false);
    }, 50);
  }, []);


  // Keyboard shortcuts (only when SVG is focused or with Ctrl/Cmd)
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keyboard shortcuts if:
    // 1. The SVG element is focused, OR
    // 2. Ctrl/Cmd is pressed (for global shortcuts)
    const isSvgFocused = document.activeElement === svgRef.current;
    const hasModifier = e.ctrlKey || e.metaKey;

    if (!isSvgFocused && !hasModifier) return;

    const currentZoom = currentViewport.zoomLevel;
    const newViewport = { ...currentViewport };

    switch (e.key) {
      case 'r':
      case 'R':
        // Reset view
        newViewport.offsetX = 0;
        newViewport.offsetY = 0;
        newViewport.zoomLevel = 0.66;
        break;
      case '0':
        // Reset zoom to 1
        newViewport.zoomLevel = 1;
        break;
      case '+':
      case '=':
        // Zoom in
        newViewport.zoomLevel = Math.min(50, currentZoom * 1.2);
        break;
      case '-':
      case '_':
        // Zoom out
        newViewport.zoomLevel = Math.max(0.1, currentZoom / 1.2);
        break;
      default:
        return; // Don't prevent default for unhandled keys
    }

    updateViewport(newViewport);
    e.preventDefault();
  }, [currentViewport, updateViewport]);

  // Add keyboard event listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Add wheel event listener with passive: false to allow preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();

      const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoomLevel = Math.max(0.1, Math.min(50, currentViewport.zoomLevel * scaleFactor));

      if (newZoomLevel === currentViewport.zoomLevel) return;

      // Get mouse position in math coordinates before zoom
      const mouseScreenCoords = { x: e.clientX, y: e.clientY };
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect) return;

      const mouseX = mouseScreenCoords.x - svgRect.left;
      const mouseY = mouseScreenCoords.y - svgRect.top;
      const mathCoords = toMathCoords(mouseX, mouseY);

      // Update zoom
      const newViewport = { ...currentViewport, zoomLevel: newZoomLevel };

      // Calculate new scale
      const newScale = baseScale * newZoomLevel;

      // Adjust offset to zoom toward mouse position
      const zoomFactor = newZoomLevel / currentViewport.zoomLevel;
      newViewport.offsetX = mathCoords.x - (mathCoords.x - currentViewport.offsetX) * zoomFactor;
      newViewport.offsetY = mathCoords.y - (mathCoords.y - currentViewport.offsetY) * zoomFactor;

      updateViewport(newViewport);
    };

    svg.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      svg.removeEventListener('wheel', handleWheelEvent);
    };
  }, [currentViewport, baseScale, toMathCoords, updateViewport]);

  // Helper functions for external control
  const resetView = useCallback(() => {
    updateViewport({ offsetX: 0, offsetY: 0, zoomLevel: 3 });
  }, []);

  const centerView = useCallback(() => {
    // Get current viewport state to preserve zoom level
    const currentZoom = currentViewport.zoomLevel;
    const newViewport = { offsetX: 0, offsetY: 0, zoomLevel: currentZoom };
    updateViewport(newViewport);
  }, [currentViewport.zoomLevel, updateViewport]);

  const zoomIn = useCallback(() => {
    const newViewport = { ...currentViewport, zoomLevel: Math.min(50, currentViewport.zoomLevel * 1.25) };
    updateViewport(newViewport);
  }, [currentViewport, updateViewport]);

  const zoomOut = useCallback(() => {
    const newViewport = { ...currentViewport, zoomLevel: Math.max(0.1, currentViewport.zoomLevel * 0.8) };
    updateViewport(newViewport);
  }, [currentViewport, updateViewport]);


  // Shared step size calculation for grid lines, tick marks, and tick labels
  const stepSize = useMemo(() => {
    const calculateOptimalStepSize = (crowding: number, zoom: number): number => {
      // Target pixels between tick marks - adjust based on crowding
      const targetScreenStep = 40 / (crowding / 3); // Base 40px, denser with higher crowding

      // Convert to math coordinates
      const pixelsPerUnit = (width / range) * zoom;
      const targetMathStep = targetScreenStep / pixelsPerUnit;

      // Calculate the magnitude (power of 10)
      const magnitude = Math.pow(10, Math.floor(Math.log10(targetMathStep)));

      // Normalize to 1-10 range
      const normalized = targetMathStep / magnitude;

      // Choose nice fraction: 1, 2, 5, or 10
      let niceFraction;
      if (normalized <= 1) {
        niceFraction = 1;
      } else if (normalized <= 2) {
        niceFraction = 2;
      } else if (normalized <= 5) {
        niceFraction = 5;
      } else {
        niceFraction = 10;
      }

      return niceFraction * magnitude;
    };
    return calculateOptimalStepSize(tickCrowding || 3, currentViewport.zoomLevel);
  }, [tickCrowding, currentViewport.zoomLevel, width, range]);

  const gridLines = useMemo(() => {
    const lines = [];
    const tickSize = config?.tickSize || 6;

    // Calculate visible range in math coordinates
    const topLeft = toMathCoords(0, 0);
    const bottomRight = toMathCoords(width, height);

    
    // Vertical grid lines (constant x)
    for (let x = Math.ceil(topLeft.x / stepSize) * stepSize; x <= bottomRight.x; x += stepSize) {
      const screen = toScreenCoords(x, 0);
      if (screen.x >= 0 && screen.x <= width) {
        lines.push(
          <line
            key={`vline-${x}`}
            x1={screen.x}
            y1={0}
            x2={screen.x}
            y2={height}
            className="diagram-grid-line"
            strokeWidth="1"
          />
        );
      }
    }

    // Horizontal grid lines (constant y)
    for (let y = Math.ceil(bottomRight.y / stepSize) * stepSize; y <= topLeft.y; y += stepSize) {
      const screen = toScreenCoords(0, y);
      if (screen.y >= 0 && screen.y <= height) {
        lines.push(
          <line
            key={`hline-${y}`}
            x1={0}
            y1={screen.y}
            x2={width}
            y2={screen.y}
            className="diagram-grid-line"
            strokeWidth="1"
          />
        );
      }
    }

    return lines;
  }, [toScreenCoords, toMathCoords, width, height, stepSize, config]);

  const tickMarks = useMemo(() => {
    const marks = [];
    const tickSize = config?.tickSize || 6;

    // Calculate visible range in math coordinates
    const topLeft = toMathCoords(0, 0);
    const bottomRight = toMathCoords(width, height);

    
    // Vertical tick marks (constant x)
    for (let x = Math.ceil(topLeft.x / stepSize) * stepSize; x <= bottomRight.x; x += stepSize) {
      if (x !== 0) { // Skip origin line
        const screen = toScreenCoords(x, 0);
        if (screen.x >= 0 && screen.x <= width) {
          marks.push(
            <line
              key={`vtick-${x}`}
              x1={screen.x}
              y1={toScreenCoords(0, 0).y - tickSize}
              x2={screen.x}
              y2={toScreenCoords(0, 0).y + tickSize}
              className="diagram-text-secondary"
              strokeWidth="1"
            />
          );
        }
      }
    }

    // Horizontal tick marks (constant y)
    for (let y = Math.ceil(bottomRight.y / stepSize) * stepSize; y <= topLeft.y; y += stepSize) {
      if (y !== 0) { // Skip origin line
        const screen = toScreenCoords(0, y);
        if (screen.y >= 0 && screen.y <= height) {
          marks.push(
            <line
              key={`htick-${y}`}
              x1={toScreenCoords(0, 0).x - tickSize}
              y1={screen.y}
              x2={toScreenCoords(0, 0).x + tickSize}
              y2={screen.y}
              className="diagram-text-secondary"
              strokeWidth="1"
            />
          );
        }
      }
    }

    return marks;
  }, [toScreenCoords, width, height, stepSize, config]);

  const renderPoint = (point: Point, index: number) => {
    const screen = toScreenCoords(point.x, point.y);
    return (
      <circle
        key={`point-${index}`}
        cx={screen.x}
        cy={screen.y}
        r="5"
        fill={point.color || '#ff6b6b'}
        stroke="#fff"
        strokeWidth="1"
        onMouseEnter={() => setHoveredPoint(point)}
        onMouseLeave={() => setHoveredPoint(null)}
        style={{ cursor: 'pointer' }}
      />
    );
  };

  const renderCurve = (curve: Curve, index: number) => {
    const pathData = curve.points
      .map((point, i) => {
        const screen = toScreenCoords(point.x, point.y);
        return `${i === 0 ? 'M' : 'L'} ${screen.x} ${screen.y}`;
      })
      .join(' ');

    return (
      <path
        key={`curve-${index}`}
        d={pathData}
        fill="none"
        stroke={curve.color || '#4ecdc4'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  const renderInequality = (inequality: Inequality, index: number) => {
    if (!inequality.center) return null;

    const screen = toScreenCoords(inequality.center.real, inequality.center.imaginary);
    const radius = (inequality.radius || 1) * scale;

    return (
      <circle
        key={`inequality-${index}`}
        cx={screen.x}
        cy={screen.y}
        r={radius}
        fill={inequality.color || '#cccccc'}
        fillOpacity={0.3}
        stroke={inequality.color || '#666666'}
        strokeWidth={2}
        strokeDasharray={inequality.type === 'half-plane' ? '5,5' : undefined}
      />
    );
  };

  const renderPlotRegion = (region: PlotRegion, index: number) => {
    const { points, boundary, type, color = '#4ecdc4', lineThickness = 2 } = region;

    const elements = [];

    // Render filled region as solid rectangles
    if ((type === 'filled' || type === 'both') && points.length > 0) {
      // Create filled rectangles for each point to form a solid region
      points.forEach((point, pointIndex) => {
        const screen = toScreenCoords(point.x, point.y);
        const pointSize = 4; // Size of each point rectangle for solid appearance
        elements.push(
          <rect
            key={`region-point-${index}-${pointIndex}`}
            x={screen.x - pointSize/2}
            y={screen.y - pointSize/2}
            width={pointSize}
            height={pointSize}
            fill={color}
            fillOpacity={0.6}
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
                strokeWidth={lineThickness.toString()}
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
            strokeWidth={lineThickness.toString()}
          />
        );
      }
    }

    // Add label - always visible when showAllLabels is true, or on hover
    if (region.expression && (showAllLabels || hoveredRegion === region)) {
      const labelPosition = calculateOptimalLabelPosition(region);
      if (labelPosition) {
        const screen = toScreenCoords(labelPosition.x, labelPosition.y);
        elements.push(
          <text
            key={`region-label-${index}`}
            x={screen.x}
            y={screen.y - 10} // Position above the curve
            fontSize="14"
            fill={color}
            textAnchor="middle"
            fontWeight="bold"
            className="pointer-events-none"
                      >
            {region.expression}
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

  // Calculate optimal label position next to curve rather than at center
  const calculateOptimalLabelPosition = (region: PlotRegion): { x: number; y: number } | null => {
    const cacheKey = region.expression || `region-${JSON.stringify(region.points.slice(0, 5))}`;

    // Check cache first to prevent jumping during pan
    if (labelPositionCache.current.has(cacheKey)) {
      return labelPositionCache.current.get(cacheKey)!;
    }

    let result: { x: number; y: number } | null = null;

    // Strategy 1: Use boundary points to position label next to curve
    if (region.boundary.length > 0) {
      let allBoundaryPoints: Point[] = [];

      if (Array.isArray(region.boundary[0])) {
        // Multiple curves - use the first one
        allBoundaryPoints = region.boundary[0] as Point[];
      } else {
        // Single curve
        allBoundaryPoints = region.boundary as Point[];
      }

      if (allBoundaryPoints.length > 0) {
        // Strategy for different curve types based on point patterns
        if (allBoundaryPoints.length > 20) {
          // Likely a circle or complex curve - find a point on the right edge
          const rightmostPoint = allBoundaryPoints.reduce((max, point) =>
            point.x > max.x ? point : max, allBoundaryPoints[0]);

          // Offset the label outward from the curve
          const centerBounds = calculateRegionBounds(region);
          if (centerBounds) {
            const directionX = rightmostPoint.x - centerBounds.centerX;
            const directionY = rightmostPoint.y - centerBounds.centerY;
            const length = Math.sqrt(directionX * directionX + directionY * directionY);

            if (length > 0) {
              // Position label outside the curve boundary
              const offsetDistance = 0.5; // Small offset in math coordinates
              result = {
                x: rightmostPoint.x + (directionX / length) * offsetDistance,
                y: rightmostPoint.y + (directionY / length) * offsetDistance
              };
            }
          }
        } else if (allBoundaryPoints.length >= 2) {
          // Likely a line or simple curve - use the midpoint with perpendicular offset
          const midIndex = Math.floor(allBoundaryPoints.length / 2);
          const midPoint = allBoundaryPoints[midIndex];

          if (midIndex > 0 && midIndex < allBoundaryPoints.length - 1) {
            // Calculate perpendicular direction
            const prevPoint = allBoundaryPoints[midIndex - 1];
            const nextPoint = allBoundaryPoints[midIndex + 1];
            const directionX = nextPoint.x - prevPoint.x;
            const directionY = nextPoint.y - prevPoint.y;

            // Perpendicular offset (rotate 90 degrees)
            const perpX = -directionY;
            const perpY = directionX;
            const length = Math.sqrt(perpX * perpX + perpY * perpY);

            if (length > 0) {
              const offsetDistance = 0.3;
              result = {
                x: midPoint.x + (perpX / length) * offsetDistance,
                y: midPoint.y + (perpY / length) * offsetDistance
              };
            }
          } else {
            // Fallback to midpoint
            result = { x: midPoint.x, y: midPoint.y };
          }
        } else {
          // Single point or very short curve
          result = allBoundaryPoints[0];
        }
      }
    }

    // Strategy 2: Fallback to using points if no boundary
    if (!result && region.points.length > 0) {
      // Use the first point with a small offset
      result = {
        x: region.points[0].x + 0.2,
        y: region.points[0].y + 0.2
      };
    }

    // Cache the result
    if (result) {
      labelPositionCache.current.set(cacheKey, result);
    }

    return result;
  };

  const calculateRegionBounds = (region: PlotRegion) => {
    let allPoints = [...region.points];

    // Add boundary points
    if (region.boundary.length > 0) {
      if (Array.isArray(region.boundary[0])) {
        // Multiple curves
        region.boundary.forEach((curve) => {
          allPoints = allPoints.concat(curve);
        });
      } else {
        // Single curve
        allPoints = allPoints.concat(region.boundary as Point[]);
      }
    }

    if (allPoints.length === 0) return null;

    const minX = Math.min(...allPoints.map(p => p.x));
    const maxX = Math.max(...allPoints.map(p => p.x));
    const minY = Math.min(...allPoints.map(p => p.y));
    const maxY = Math.max(...allPoints.map(p => p.y));

    return {
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2,
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Define tickSize for line length (fixed)
  const tickSize = config?.tickSize || 6;

  return (
    <div className="argand-diagram">
      {/* Controls bar above graph */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #ccc'}}>
        {isControlsCollapsed && onToggleControls && (
          <button
            onClick={onToggleControls}
            title="Expand Expressions Panel"
            style={{padding: '2px 8px', margin: '0', fontSize: '12px'}}
          >
            →
          </button>
        )}

        <div style={{flex: '1', textAlign: 'center'}}>
          <h4 style={{margin: '0', fontSize: '14px', fontWeight: 'bold'}}>Argand Diagram</h4>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: '4px', marginLeft: isControlsCollapsed ? '0' : 'auto'}}>
          <button onClick={zoomIn} title="Zoom In" style={{padding: '2px 4px', margin: '0 2px'}}>+</button>
          <button onClick={zoomOut} title="Zoom Out" style={{padding: '2px 4px', margin: '0 2px'}}>−</button>
          <button onClick={centerView} title="Center on Origin" style={{padding: '2px 4px', margin: '0 2px'}}>⌖</button>
          <button onClick={resetView} title="Reset View" style={{padding: '2px 4px', margin: '0 2px'}}>↺</button>
          {onTickCrowdingChange && (
            <>
              <span style={{display: 'inline-block', width: '20px'}}></span>
              <button
                onClick={() => onTickCrowdingChange(Math.max(1, tickCrowding - 1))}
                title="Less"
                disabled={tickCrowding <= 1}
                style={{padding: '2px 4px', margin: '0 2px'}}
              >
                −
              </button>
              <button
                onClick={() => onTickCrowdingChange(Math.min(5, tickCrowding + 1))}
                title="More"
                disabled={tickCrowding >= 5}
                style={{padding: '2px 4px', margin: '0 2px'}}
              >
                +
              </button>
            </>
          )}
        </div>
      </div>

      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border-l border-r border-b diagram-svg-border focus:outline-none focus:ring-2 focus:ring-blue-400"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
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
          strokeWidth="1"
        />
        <line
          x1={toScreenCoords(0, 0).x}
          y1="0"
          x2={toScreenCoords(0, 0).x}
          y2={height}
          className="diagram-axis"
          strokeWidth="1"
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

        {/* Tick labels */}
        {(() => {
          const labels = [];
          const topLeft = toMathCoords(0, 0);
          const bottomRight = toMathCoords(width, height);

          // X-axis labels (real numbers)
          for (let x = Math.ceil(topLeft.x / stepSize) * stepSize; x <= bottomRight.x; x += stepSize) {
            if (x !== 0) {
              const screen = toScreenCoords(x, 0);
              if (screen.x >= 10 && screen.x <= width - 10) {
                labels.push(
                  <text
                    key={`xlabel-${x}`}
                    x={screen.x}
                    y={toScreenCoords(0, 0).y + 20}
                    fontSize="10"
                    className="diagram-text-primary"
                    textAnchor="middle"
                  >
                    {x % 1 === 0 ? x.toFixed(0) : x.toFixed(1)}
                  </text>
                );
              }
            }
          }

          // Y-axis labels (imaginary numbers)
          for (let y = Math.ceil(bottomRight.y / stepSize) * stepSize; y <= topLeft.y; y += stepSize) {
            if (y !== 0) {
              const screen = toScreenCoords(0, y);
              if (screen.y >= 10 && screen.y <= height - 10) {
                labels.push(
                  <text
                    key={`ylabel-${y}`}
                    x={toScreenCoords(0, 0).x - 10}
                    y={screen.y + 3}
                    fontSize="10"
                    className="diagram-text-primary"
                    textAnchor="end"
                  >
                    {y % 1 === 0 ? y.toFixed(0) : y.toFixed(1)}
                  </text>
                );
              }
            }
          }

          return labels;
        })()}

        {/* Render plot regions from expressions first (background) */}
        {(isPanning ? cachedPlotRegions.current : plotData?.regions || []).map((region, index) =>
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

      {/* Simple point tooltip */}
      {hoveredPoint && (
        <div
          className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded p-2 shadow-lg"
          style={{
            left: `${toScreenCoords(hoveredPoint.x, hoveredPoint.y).x + 10}px`,
            top: `${toScreenCoords(hoveredPoint.x, hoveredPoint.y).y - 30}px`,
            pointerEvents: 'none',
            fontSize: '12px'
          }}
        >
          <div>x: {hoveredPoint.x.toFixed(2)}</div>
          <div>y: {hoveredPoint.y.toFixed(2)}i</div>
          {hoveredPoint.label && <div>Label: {hoveredPoint.label}</div>}
        </div>
      )}
    </div>
  );
};

export default ArgandDiagram;
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
  const currentViewport = useMemo(() => viewport || {
    offsetX: 0,
    offsetY: 0,
    zoomLevel: 0.66
  }, [viewport]);

  // Format tick labels to handle floating point precision gracefully
  const formatTickLabel = useCallback((value: number): string => {
    // Handle very small numbers with scientific notation if needed
    if (Math.abs(value) < 0.0001 && value !== 0) {
      return value.toExponential(2);
    }

    // For regular numbers, use appropriate precision
    // If the number is very close to an integer, show as integer
    const tolerance = 1e-10;
    if (Math.abs(value - Math.round(value)) < tolerance) {
      return Math.round(value).toString();
    }

    // For other numbers, show enough precision to distinguish them
    // but avoid floating point artifacts
    const precision = Math.max(0, -Math.floor(Math.log10(Math.abs(value - Math.round(value)))));
    return parseFloat(value.toPrecision(Math.min(15, Math.max(2, precision + 2)))).toString();
  }, []);

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

  // Touch state for mobile interaction
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0, distance: 0 });
  const [isTouchZooming, setIsTouchZooming] = useState(false);
  const [touchStartViewport, setTouchStartViewport] = useState<ViewportState | null>(null);

  const baseScale = (width * 3) / (2 * range);
  const scale = baseScale * currentViewport.zoomLevel;
  const center = useMemo(() => ({ x: width / 2, y: height / 2 }), [width, height]);

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

  // Touch event handlers for mobile interaction
  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    if (e.touches.length === 1) {
      // Single touch - start panning
      setIsDragging(true);
      setIsPanning(true);

      // Cache current plot regions for display during panning
      if (plotData?.regions) {
        cachedPlotRegions.current = [...plotData.regions];
      }

      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setTouchStart({ x: touch.clientX, y: touch.clientY, distance: 0 });
    } else if (e.touches.length === 2) {
      // Two touches - start zooming
      setIsTouchZooming(true);
      setIsDragging(false);

      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      setTouchStart({ x: centerX, y: centerY, distance });
      setTouchStartViewport(currentViewport);
    }

    e.preventDefault();
  }, [plotData, currentViewport]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    if (e.touches.length === 1 && isDragging && !isTouchZooming) {
      // Single touch - pan
      const touch = e.touches[0];
      const deltaX = touch.clientX - dragStart.x;
      const deltaY = touch.clientY - dragStart.y;

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

      setDragStart({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2 && isTouchZooming && touchStartViewport) {
      // Two touches - zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );

      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;

      const scaleFactor = touchStart.distance > 0 ? distance / touchStart.distance : 1;

      // Calculate new zoom level
      const newZoomLevel = touchStartViewport.zoomLevel * scaleFactor;

      // Keep the center point fixed during zoom
      const worldBeforeZoomX = (centerX - center.x) / scale + touchStartViewport.offsetX;
      const worldBeforeZoomY = -(centerY - center.y) / scale + touchStartViewport.offsetY;

      const newScale = baseScale * newZoomLevel;
      const newOffsetX = worldBeforeZoomX - (centerX - center.x) / newScale;
      const newOffsetY = worldBeforeZoomY + (centerY - center.y) / newScale;

      const newViewport = {
        ...touchStartViewport,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
        zoomLevel: newZoomLevel
      };

      updateViewport(newViewport);
    }

    e.preventDefault();
  }, [isDragging, isTouchZooming, dragStart, touchStart, touchStartViewport, scale, currentViewport, updateViewport, center, baseScale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (e.touches.length === 0) {
      // All touches ended
      setIsDragging(false);
      setIsTouchZooming(false);
      setTouchStartViewport(null);

      // Add a small delay before ending panning to prevent flicker
      setTimeout(() => {
        setIsPanning(false);
      }, 50);
    } else if (e.touches.length === 1 && isTouchZooming) {
      // Transition from zoom to pan
      setIsTouchZooming(false);
      setIsDragging(true);
      setIsPanning(true);

      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
    }

    e.preventDefault();
  }, [isTouchZooming]);


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
        newViewport.zoomLevel = currentZoom * 1.2;
        break;
      case '-':
      case '_':
        // Zoom out
        newViewport.zoomLevel = currentZoom / 1.2;
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
      const newZoomLevel = currentViewport.zoomLevel * scaleFactor;

      if (newZoomLevel === currentViewport.zoomLevel) return;

      // Get mouse position relative to SVG
      const svgRect = svg.getBoundingClientRect();
      if (!svgRect) return;

      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;

      // Method 1: Keep the point under the mouse fixed in world coordinates
      // 1. Convert mouse position to world coordinates BEFORE zoom
      const worldBeforeZoomX = (mouseX - center.x) / scale + currentViewport.offsetX;
      const worldBeforeZoomY = -(mouseY - center.y) / scale + currentViewport.offsetY;

      // 2. Calculate new viewport offset so the same world point is under the mouse AFTER zoom
      const newScale = baseScale * newZoomLevel;
      const newOffsetX = worldBeforeZoomX - (mouseX - center.x) / newScale;
      const newOffsetY = worldBeforeZoomY + (mouseY - center.y) / newScale;

      const newViewport = {
        ...currentViewport,
        offsetX: newOffsetX,
        offsetY: newOffsetY,
        zoomLevel: newZoomLevel
      };

      updateViewport(newViewport);
    };

    svg.addEventListener('wheel', handleWheelEvent, { passive: false });

    return () => {
      svg.removeEventListener('wheel', handleWheelEvent);
    };
  }, [currentViewport, baseScale, toMathCoords, updateViewport]);

  // Helper functions for external control
  const resetView = useCallback(() => {
    updateViewport({ offsetX: 0, offsetY: 0, zoomLevel: 0.66 });
  }, []);

  const centerView = useCallback(() => {
    // Get current viewport state to preserve zoom level
    const currentZoom = currentViewport.zoomLevel;
    const newViewport = { offsetX: 0, offsetY: 0, zoomLevel: currentZoom };
    updateViewport(newViewport);
  }, [currentViewport.zoomLevel, updateViewport]);

  const zoomIn = useCallback(() => {
    const newViewport = { ...currentViewport, zoomLevel: currentViewport.zoomLevel * 1.25 };
    updateViewport(newViewport);
  }, [currentViewport, updateViewport]);

  const zoomOut = useCallback(() => {
    const newViewport = { ...currentViewport, zoomLevel: currentViewport.zoomLevel * 0.8 };
    updateViewport(newViewport);
  }, [currentViewport, updateViewport]);


  // Shared step size calculation for grid lines, tick marks, and tick labels
  const stepSize = useMemo(() => {
    const calculateOptimalStepSize = (crowding: number, zoom: number): number => {
      // Target pixels between tick marks - adjust based on crowding
      const targetScreenStep = 40 / (crowding / 3); // Base 40px, denser with higher crowding

      // Convert to math coordinates
      const pixelsPerUnit = (width / range) * zoom;
      let targetMathStep = targetScreenStep / pixelsPerUnit;

      // Prevent step size from becoming too small at high zoom levels
      // This ensures labels remain visible and readable
      const minStepSize = 0.01;
      const maxStepSize = 1000;

      // Clamp targetMathStep to reasonable bounds
      targetMathStep = Math.max(minStepSize, Math.min(maxStepSize, targetMathStep));

      // Handle very small numbers to prevent log10 of 0 or negative
      if (targetMathStep <= 0) {
        return minStepSize;
      }

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

      const finalStepSize = niceFraction * magnitude;

      // Final clamp to ensure we don't get extreme values
      return Math.max(minStepSize, Math.min(maxStepSize, finalStepSize));
    };
    return calculateOptimalStepSize(tickCrowding || 3, currentViewport.zoomLevel);
  }, [tickCrowding, currentViewport.zoomLevel, width, range]);

  const gridLines = useMemo(() => {
    const lines = [];

    // Calculate visible range in math coordinates
    const topLeft = toMathCoords(0, 0);
    const bottomRight = toMathCoords(width, height);

    
    // Vertical grid lines (constant x)
    for (let x = Math.ceil(topLeft.x / stepSize) * stepSize; x <= bottomRight.x; x += stepSize) {
      if (Math.abs(x) > stepSize * 0.1) { // Skip origin line
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
    }

    // Horizontal grid lines (constant y)
    for (let y = Math.ceil(bottomRight.y / stepSize) * stepSize; y <= topLeft.y; y += stepSize) {
      if (Math.abs(y) > stepSize * 0.1) { // Skip origin line
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

  const createRegionPath = (points: Point[]): string | null => {
    if (points.length < 3) return null;

    // Try to detect if this is approximately circular by checking point distribution
    const bounds = getPointBounds(points);
    if (!bounds) return null;

    const { minX, maxX, minY, maxY } = bounds;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const radiusX = (maxX - minX) / 2;
    const radiusY = (maxY - minY) / 2;

    // Check if it's roughly circular (similar radii in X and Y)
    const aspectRatio = radiusX / radiusY;
    if (aspectRatio > 0.8 && aspectRatio < 1.2) {
      // Likely circular, create a circle
      const screenCenter = toScreenCoords(centerX, centerY);
      const screenRadius = ((radiusX + radiusY) / 2) * scale; // Average radius scaled

      return `M ${screenCenter.x - screenRadius} ${screenCenter.y} A ${screenRadius} ${screenRadius} 0 0 1 ${screenCenter.x + screenRadius} ${screenCenter.y} A ${screenRadius} ${screenRadius} 0 0 1 ${screenCenter.x - screenRadius} ${screenCenter.y}`;
    } else {
      // Not circular, use convex hull
      const hullPoints = computeConvexHull(points);
      if (hullPoints.length < 3) return null;

      const pathData = hullPoints
        .map((point, i) => {
          const screen = toScreenCoords(point.x, point.y);
          return `${i === 0 ? 'M' : 'L'} ${screen.x.toFixed(1)} ${screen.y.toFixed(1)}`;
        })
        .join(' ') + ' Z';

      return pathData;
    }
  };

  const createSmoothPath = (points: Point[]): string => {
    if (points.length < 2) return '';

    const pathCommands: string[] = [];

    points.forEach((point, i) => {
      const screen = toScreenCoords(point.x, point.y);
      const x = screen.x.toFixed(1);
      const y = screen.y.toFixed(1);

      if (i === 0) {
        pathCommands.push(`M ${x} ${y}`);
      } else if (i === 1 || i === points.length - 1) {
        // First and last segments use lines
        pathCommands.push(`L ${x} ${y}`);
      } else {
        // Use quadratic bezier curves for smoother paths
        const prevScreen = toScreenCoords(points[i - 1].x, points[i - 1].y);
        const nextScreen = toScreenCoords(points[i + 1].x, points[i + 1].y);

        const controlX = ((prevScreen.x + nextScreen.x) / 2).toFixed(1);
        const controlY = ((prevScreen.y + nextScreen.y) / 2).toFixed(1);

        pathCommands.push(`Q ${controlX} ${controlY} ${x} ${y}`);
      }
    });

    // Close the path
    pathCommands.push('Z');

    return pathCommands.join(' ');
  };

  const computeRegionBoundary = (points: Point[]): Point[] => {
    if (points.length < 3) return points;

    // For complex regions, use alpha shape / concave hull algorithm
    // This gives better boundaries than convex hull for inequality regions

    // First try to create a more accurate boundary using grid-based approach
    const boundary = extractRegionBoundary(points);

    if (boundary.length >= 3) {
      // Apply smoothing to create cleaner edges
      return smoothBoundary(boundary);
    }

    // Fallback to convex hull if boundary extraction fails
    return computeConvexHull(points);
  };

  const extractRegionBoundary = (points: Point[]): Point[] => {
    // Create a density grid to find the outer boundary
    const bounds = getPointBounds(points);
    if (!bounds) return [];

    const { minX, maxX, minY, maxY } = bounds;
    const gridSize = 0.2; // Finer grid for better boundary detection
    const gridWidth = Math.ceil((maxX - minX) / gridSize);
    const gridHeight = Math.ceil((maxY - minY) / gridSize);

    const grid: boolean[][] = Array(gridHeight).fill(null).map(() => Array(gridWidth).fill(false));

    // Populate grid with points
    points.forEach(point => {
      const gridX = Math.floor((point.x - minX) / gridSize);
      const gridY = Math.floor((point.y - minY) / gridSize);

      if (gridX >= 0 && gridX < gridWidth && gridY >= 0 && gridY < gridHeight) {
        // Mark surrounding cells to create a filled region
        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const nx = gridX + dx;
            const ny = gridY + dy;
            if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
              grid[ny][nx] = true;
            }
          }
        }
      }
    });

    // Extract boundary using Moore neighborhood tracing
    const boundaryPoints: Point[] = [];
    const visited = new Set<string>();

    for (let y = 1; y < gridHeight - 1; y++) {
      for (let x = 1; x < gridWidth - 1; x++) {
        const key = `${x},${y}`;
        if (grid[y][x] && !visited.has(key) && isBoundaryCell(grid, x, y)) {
          const trace = traceBoundary(grid, x, y, visited, minX, minY, gridSize);
          boundaryPoints.push(...trace);
        }
      }
    }

    return boundaryPoints;
  };

  const getPointBounds = (points: Point[]) => {
    if (points.length === 0) return null;

    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;

    points.forEach(point => {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });

    const padding = 0.5 * Math.max(maxX - minX, maxY - minY);
    return {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding
    };
  };

  const isBoundaryCell = (grid: boolean[][], x: number, y: number): boolean => {
    // A cell is on the boundary if it's filled but has at least one empty neighbor
    if (!grid[y][x]) return false;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const ny = y + dy;
        const nx = x + dx;
        if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length || !grid[ny][nx]) {
          return true;
        }
      }
    }
    return false;
  };

  const traceBoundary = (grid: boolean[][], startX: number, startY: number, visited: Set<string>,
                        offsetX: number, offsetY: number, cellSize: number): Point[] => {
    const boundary: Point[] = [];
    let x = startX, y = startY;
    let direction = 0; // Start direction (0-7 for 8 directions)
    const directions = [
      [-1, 0], [-1, 1], [0, 1], [1, 1],
      [1, 0], [1, -1], [0, -1], [-1, -1]
    ];

    const startKey = `${x},${y}`;

    do {
      visited.add(`${x},${y}`);

      // Add boundary point with sub-pixel precision
      boundary.push({
        x: offsetX + x * cellSize + cellSize / 2,
        y: offsetY + y * cellSize + cellSize / 2
      });

      // Find next boundary cell
      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (direction + i + 6) % 8; // Turn right first
        const [dx, dy] = directions[newDir];
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < grid[0].length && ny >= 0 && ny < grid.length &&
            grid[ny][nx] && isBoundaryCell(grid, nx, ny)) {
          x = nx;
          y = ny;
          direction = newDir;
          found = true;
          break;
        }
      }

      if (!found) break;

    } while (x !== startX || y !== startY || boundary.length === 1);

    return boundary;
  };

  const smoothBoundary = (points: Point[]): Point[] => {
    if (points.length < 4) return points;

    const smoothed: Point[] = [];

    for (let i = 0; i < points.length; i++) {
      const prev = points[(i - 1 + points.length) % points.length];
      const curr = points[i];
      const next = points[(i + 1) % points.length];

      // Apply simple averaging smoothing
      const weight = 0.3; // Smoothing factor
      smoothed.push({
        x: curr.x * (1 - 2 * weight) + (prev.x + next.x) * weight,
        y: curr.y * (1 - 2 * weight) + (prev.y + next.y) * weight
      });
    }

    return smoothed;
  };

  const computeConvexHull = (points: Point[]): Point[] => {
    if (points.length < 3) return points;

    // Graham's scan algorithm for convex hull (fallback)
    const sortedPoints = [...points].sort((a, b) => {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    // Remove duplicates
    const uniquePoints: Point[] = [];
    for (let i = 0; i < sortedPoints.length; i++) {
      if (i === 0 || sortedPoints[i].x !== sortedPoints[i-1].x || sortedPoints[i].y !== sortedPoints[i-1].y) {
        uniquePoints.push(sortedPoints[i]);
      }
    }

    if (uniquePoints.length < 3) return uniquePoints;

    // Cross product of vectors OA and OB
    const crossProduct = (O: Point, A: Point, B: Point): number => {
      return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    };

    // Build lower hull
    const lower: Point[] = [];
    for (const point of uniquePoints) {
      while (lower.length >= 2 && crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
        lower.pop();
      }
      lower.push(point);
    }

    // Build upper hull
    const upper: Point[] = [];
    for (let i = uniquePoints.length - 1; i >= 0; i--) {
      const point = uniquePoints[i];
      while (upper.length >= 2 && crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
        upper.pop();
      }
      upper.push(point);
    }

    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();

    // Concatenate lower and upper hulls
    return [...lower, ...upper];
  };

  const renderPlotRegion = (region: PlotRegion, index: number) => {
    const { points, boundary, type, color = '#4ecdc4', lineThickness = 2 } = region;

    const elements = [];

    // Render filled region using simple effective method
    if ((type === 'filled' || type === 'both') && points.length > 0) {
      // Simple convex hull for solid filled region
      const regionPath = createRegionPath(points);
      if (regionPath) {
        elements.push(
          <path
            key={`region-filled-${index}`}
            d={regionPath}
            fill={color}
            fillOpacity={0.3}
            stroke="none"
          />
        );
      } else {
        // Fallback: render as small circles for sparse regions
        points.forEach((point, pointIndex) => {
          const screen = toScreenCoords(point.x, point.y);
          const pointSize = 2;
          elements.push(
            <circle
              key={`region-point-${index}-${pointIndex}`}
              cx={screen.x}
              cy={screen.y}
              r={pointSize}
              fill={color}
              fillOpacity={0.4}
            />
          );
        });
      }
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
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        tabIndex={0}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
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
            if (Math.abs(x) > stepSize * 0.1) { // Skip origin label
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
                    {formatTickLabel(x)}
                  </text>
                );
              }
            }
          }

          // Y-axis labels (imaginary numbers)
          for (let y = Math.ceil(bottomRight.y / stepSize) * stepSize; y <= topLeft.y; y += stepSize) {
            if (Math.abs(y) > stepSize * 0.1) { // Skip origin label
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
                    {formatTickLabel(y)}
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
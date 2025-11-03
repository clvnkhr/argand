import { useState, useCallback, useMemo, useEffect } from 'react';
import ArgandDiagram from './components/ArgandDiagram';
import ExpressionPanel from './components/ExpressionPanel';
import { PlotConfig } from './types/complex';
import { PlotExpression } from './types/expressions';
import { HybridPlotter } from './math/plotting';
import { ExpressionParser } from './math/parser';
import './App.css';

function App() {
  const [expressions, setExpressions] = useState<PlotExpression[]>([]);
  const [viewport, setViewport] = useState({ offsetX: 0, offsetY: 0, zoomLevel: 0.66 });
  const [tickCrowding, setTickCrowding] = useState(3); // 1=very sparse, 5=very dense
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: 800,
    height: 600
  });

  useEffect(() => {
    const updateDimensions = () => {
      const controlsWidth = isCollapsed ? 0 : 320;
      const controlsBarHeight = 40; // Account for zoom controls bar

      setDimensions({
        width: window.innerWidth - controlsWidth,
        height: window.innerHeight - controlsBarHeight
      });
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isCollapsed]);

  const config: PlotConfig = {
    width: dimensions.width,
    height: dimensions.height,
    range: 15,
    resolution: 50,
    adaptiveSampling: true,
    showGrid: true,
    showAxes: true,
    backgroundColor: '#ffffff',
    gridColor: '#e0e0e0',
    axisColor: '#333333',
    tickSize: 6 // Keep the line length fixed
  };

  // Generate combined plot data from all visible expressions
  const plotData = useMemo(() => {
    // Update config with viewport information
    const configWithViewport = {
      ...config,
      viewportOffsetX: viewport.offsetX,
      viewportOffsetY: viewport.offsetY,
      viewportZoom: viewport.zoomLevel
    };

    const plotter = new HybridPlotter(configWithViewport);
    const allRegions = [];

    for (const expression of expressions) {
      // Skip invisible expressions
      if (expression.visible === false) {
        continue;
      }

      try {
        // Parse the expression to get AST
        const parser = new ExpressionParser();
        const result = parser.parseExpressionString(expression.expression);

        if (!result.error) {
          const plotResult = plotter.plotExpression(result.ast, expression.expression, expression);
          if (plotResult.regions && plotResult.regions.length > 0) {
            // Add expression metadata to regions
            const regionsWithMeta = plotResult.regions.map(region => ({
              ...region,
              color: expression.color || region.color,
              lineThickness: expression.lineThickness || region.lineThickness,
              expression: expression.label || expression.expression
            }));
            allRegions.push(...regionsWithMeta);
          }
        }
      } catch (error) {
        console.error('Error plotting expression:', expression.expression, error);
      }
    }

    return { regions: allRegions };
  }, [expressions, config, viewport, dimensions]);

  const handleExpressionsChange = useCallback((newExpressions: PlotExpression[]) => {
    setExpressions(newExpressions);
  }, []);

  const handleViewportChange = useCallback((newViewport: any) => {
    setViewport(newViewport);
  }, []);

  return (
    <div className="App">
      <main className="container">
        <div className={`controls-container${isCollapsed ? ' collapsed' : ''}`}>
          <ExpressionPanel
            onExpressionsChange={handleExpressionsChange}
            config={config}
            onPlotGenerated={() => {}} // No-op since plot data is generated from expressions
            isCollapsed={isCollapsed}
            onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          />
        </div>

        <div className="diagram-container">
          <ArgandDiagram
            elements={[]}
            plotData={plotData}
            width={config.width}
            height={config.height}
            range={config.range}
            config={config}
            viewport={viewport}
            onViewportChange={handleViewportChange}
            tickCrowding={tickCrowding}
            onTickCrowdingChange={setTickCrowding}
            isControlsCollapsed={isCollapsed}
            onToggleControls={() => setIsCollapsed(!isCollapsed)}
          />
        </div>
          </main>
    </div>
  );
}

export default App;
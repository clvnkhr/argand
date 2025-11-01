import { useState, useCallback, useMemo } from 'react';
import ArgandDiagram from './components/ArgandDiagram';
import ExpressionPanel from './components/ExpressionPanel';
import { PlotConfig } from './types/complex';
import { PlotExpression } from './types/expressions';
import { HybridPlotter } from './math/plotting';
import { ExpressionParser } from './math/parser';
import './App.css';

function App() {
  const [expressions, setExpressions] = useState<PlotExpression[]>([]);

  const config: PlotConfig = {
    width: 700,
    height: 700,
    range: 15,
    resolution: 50,
    adaptiveSampling: true,
    showGrid: true,
    showAxes: true,
    backgroundColor: '#ffffff',
    gridColor: '#e0e0e0',
    axisColor: '#333333'
  };

  // Generate combined plot data from all visible expressions
  const plotData = useMemo(() => {
    const plotter = new HybridPlotter(config);
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
          const plotResult = plotter.plotExpression(result.ast, expression.expression);
          if (plotResult.regions && plotResult.regions.length > 0) {
            // Add expression metadata to regions
            const regionsWithMeta = plotResult.regions.map(region => ({
              ...region,
              color: expression.color || region.color,
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
  }, [expressions, config]);

  const handleExpressionsChange = useCallback((newExpressions: PlotExpression[]) => {
    setExpressions(newExpressions);
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Advanced Argand Diagram Plotter</h1>
        <p>Plot complex mathematical expressions with LaTeX rendering and hybrid plotting</p>
      </header>

      <main className="container">
        <div className="diagram-container">
          <ArgandDiagram
            elements={[]}
            plotData={plotData}
            width={config.width}
            height={config.height}
            range={config.range}
            config={config}
          />
        </div>

        <div className="controls-container">
          <ExpressionPanel
            onExpressionsChange={handleExpressionsChange}
            config={config}
            onPlotGenerated={() => {}} // No-op since plot data is generated from expressions
          />
        </div>
      </main>

      <footer className="App-footer">
        <p>Advanced complex number visualization with mathematical expression support</p>
      </footer>
    </div>
  );
}

export default App;
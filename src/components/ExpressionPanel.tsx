import { useState, useCallback, useEffect } from 'react';
import { PlotExpression, NamedVariable } from '../types/expressions';
import { ComplexNumber } from '../types/complex';
import { ExpressionParser } from '../math/parser';
import { ExpressionEvaluator } from '../math/evaluator';
import { HybridPlotter, PlotConfig } from '../math/plotting';
import { useLatexConverter, ComplexExpressionDisplay } from './MathJaxRenderer';
import { getTemplatesByCategory, expressionTemplates, ExpressionTemplate } from '../math/templates';

interface ExpressionPanelProps {
  onExpressionsChange: (expressions: PlotExpression[]) => void;
  config: PlotConfig;
  onPlotGenerated: (plotData: any) => void;
}

export const ExpressionPanel: React.FC<ExpressionPanelProps> = ({
  onExpressionsChange,
  config,
  onPlotGenerated
}) => {
  const [expressions, setExpressions] = useState<PlotExpression[]>([]);
  const [namedVariables, setNamedVariables] = useState<NamedVariable[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentColor, setCurrentColor] = useState('#4ecdc4');
  const [currentLabel, setCurrentLabel] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [latexPreview, setLatexPreview] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');

  const parser = new ExpressionParser();
  const evaluator = new ExpressionEvaluator();
  const plotter = new HybridPlotter(config);
  const { convertToLatex } = useLatexConverter();

  // Update named variables in parser and evaluator
  useEffect(() => {
    namedVariables.forEach(variable => {
      parser.setVariable(variable.name, variable.value);
      evaluator.setVariable(variable.name, variable.value);
    });
  }, [namedVariables, parser, evaluator]);

  // Update plotter config
  useEffect(() => {
    plotter.updateConfig(config);
  }, [config, plotter]);

  // Real-time LaTeX preview
  useEffect(() => {
    if (currentInput.trim()) {
      try {
        const latex = convertToLatex(currentInput);
        setLatexPreview(latex);
        setParseError(null);
      } catch (error) {
        setLatexPreview(currentInput);
        setParseError('Invalid expression syntax');
      }
    } else {
      setLatexPreview('');
      setParseError(null);
    }
  }, [currentInput, convertToLatex]);

  const determineExpressionType = (input: string): PlotExpression['type'] => {
    const cleanInput = input.trim();

    // Check for named variable assignment
    if (/^[a-zA-Z]\s*=\s*.+/.test(cleanInput)) {
      return 'point';
    }

    // Check for strict comparison operators (excluding equality)
    if (/[<>]=?|!=/.test(cleanInput)) {
      return 'inequality';
    }

    // Check for equality (must come after inequality check)
    if (/[^<>!=]=/.test(cleanInput)) {
      return 'equality';
    }

    // Default to point
    return 'point';
  };

  const parseNamedVariable = (input: string): NamedVariable | null => {
    const match = input.match(/^([a-zA-Z])\s*=\s*(.+)$/);
    if (!match) return null;

    const name = match[1];
    const expression = match[2].trim();

    try {
      const result = parser.parseExpressionString(expression);
      if (result.error) {
        setParseError(result.error);
        return null;
      }

      const evaluation = evaluator.evaluateExpression(result.ast, { real: 0, imaginary: 0 });
      if (!evaluation.isValid) {
        setParseError(evaluation.error || 'Failed to evaluate expression');
        return null;
      }

      let value: ComplexNumber;
      if (typeof evaluation.value === 'number') {
        value = { real: evaluation.value, imaginary: 0 };
      } else if (typeof evaluation.value === 'boolean') {
        value = { real: evaluation.value ? 1 : 0, imaginary: 0 };
      } else {
        value = evaluation.value;
      }

      return {
        name,
        value,
        expression
      };
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Parse error');
      return null;
    }
  };

  const addExpression = useCallback(() => {
    if (!currentInput.trim()) return;

    const cleanInput = currentInput.trim();
    setParseError(null);

    // Check if it's a named variable assignment
    const namedVar = parseNamedVariable(cleanInput);
    if (namedVar) {
      setNamedVariables(prev => [...prev.filter(v => v.name !== namedVar.name), namedVar]);
      setCurrentInput('');
      setCurrentLabel('');
      return;
    }

    // Parse as regular expression
    try {
      const result = parser.parseExpressionString(cleanInput);
      if (result.error) {
        setParseError(result.error);
        return;
      }

      const type = determineExpressionType(cleanInput);
      const newExpression: PlotExpression = {
        type,
        expression: cleanInput,
        originalExpression: cleanInput,
        color: currentColor,
        label: currentLabel || undefined
      };

      // Generate plot data
      const plotResult = plotter.plotExpression(result.ast, cleanInput);
      if (plotResult.error) {
        setParseError(`Plotting error: ${plotResult.error}`);
        return;
      }

      const updatedExpressions = [...expressions, newExpression];
      setExpressions(updatedExpressions);
      onExpressionsChange(updatedExpressions);
      onPlotGenerated(plotResult);

      // Reset form
      setCurrentInput('');
      setCurrentLabel('');
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Error adding expression');
    }
  }, [currentInput, currentColor, currentLabel, expressions, parser, plotter, onExpressionsChange, onPlotGenerated]);

  const removeExpression = useCallback((index: number) => {
    const updatedExpressions = expressions.filter((_, i) => i !== index);
    setExpressions(updatedExpressions);
    onExpressionsChange(updatedExpressions);
  }, [expressions, onExpressionsChange]);

  const toggleExpression = useCallback((index: number) => {
    const updatedExpressions = [...expressions];
    const expression = updatedExpressions[index];

    // Toggle the visibility property
    if (expression) {
      expression.visible = expression.visible === false ? true : false; // Default to true if undefined
      onExpressionsChange(updatedExpressions);
    }
  }, [expressions, onExpressionsChange]);

  const applyTemplate = useCallback((template: ExpressionTemplate) => {
    setCurrentInput(template.template);
    setCurrentLabel(template.name);
    setShowTemplates(false);
  }, []);

  const clearAll = useCallback(() => {
    setExpressions([]);
    setNamedVariables([]);
    setCurrentInput('');
    setCurrentLabel('');
    setParseError(null);
    onExpressionsChange([]);
  }, [onExpressionsChange]);

  const categories = [
    { id: 'all', name: 'All Templates' },
    { id: 'point', name: 'Points' },
    { id: 'equality', name: 'Equalities' },
    { id: 'inequality', name: 'Inequalities' },
    { id: 'function', name: 'Functions' }
  ];

  const filteredTemplates = activeCategory === 'all'
    ? []
    : getTemplatesByCategory(activeCategory);

  return (
    <div className="expression-panel p-4 bg-gray-50 border rounded-lg space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">Mathematical Expressions</h3>

      {/* Expression Input */}
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expression
          </label>
          <div className="relative">
            <input
              type="text"
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addExpression()}
              placeholder="Enter expression (e.g., |z^2 + 1| <= 1, A = 2 + i)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {currentInput && (
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="absolute right-2 top-2 text-blue-600 hover:text-blue-800"
                title="Show templates"
              >
                📚
              </button>
            )}
          </div>
        </div>

        {/* LaTeX Preview */}
        {latexPreview && (
          <div className="bg-white p-3 border border-gray-200 rounded-md">
            <div className="text-sm text-gray-600 mb-1">Preview:</div>
            <ComplexExpressionDisplay expression={latexPreview} />
          </div>
        )}

        {/* Error Display */}
        {parseError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">
            {parseError}
          </div>
        )}

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color
            </label>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              className="w-full h-10 border border-gray-300 rounded-md cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (optional)
            </label>
            <input
              type="text"
              value={currentLabel}
              onChange={(e) => setCurrentLabel(e.target.value)}
              placeholder="Expression label"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={addExpression}
            disabled={!currentInput.trim() || !!parseError}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add Expression
          </button>
          <button
            onClick={clearAll}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-700">Expression Templates</h4>
            <button
              onClick={() => setShowTemplates(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-3">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  activeCategory === category.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Template List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredTemplates.map((template, index) => (
              <div
                key={index}
                className="bg-white p-3 border border-gray-200 rounded-md hover:bg-gray-50 cursor-pointer"
                onClick={() => applyTemplate(template)}
              >
                <div className="font-medium text-gray-800">{template.name}</div>
                <div className="text-sm text-gray-600">{template.description}</div>
                <div className="text-sm font-mono text-blue-600 mt-1">
                  <ComplexExpressionDisplay expression={template.template} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Named Variables */}
      {namedVariables.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-2">Named Variables</h4>
          <div className="space-y-2">
            {namedVariables.map(variable => (
              <div key={variable.name} className="flex items-center justify-between bg-white p-2 border rounded">
                <div>
                  <span className="font-medium">{variable.name} = </span>
                  <ComplexExpressionDisplay expression={convertToLatex(variable.expression)} />
                </div>
                <button
                  onClick={() => {
                    setNamedVariables(prev => prev.filter(v => v.name !== variable.name));
                  }}
                  className="text-red-600 hover:text-red-800"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current Expressions */}
      {expressions.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-700 mb-2">Current Expressions</h4>
          <div className="space-y-2">
            {expressions.map((expr, index) => (
              <div key={index} className="flex items-center justify-between bg-white p-3 border rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border border-gray-300"
                      style={{ backgroundColor: expr.color || '#4ecdc4' }}
                    />
                    {expr.label && <span className="font-medium">{expr.label}:</span>}
                    <span className="text-sm">
                      <ComplexExpressionDisplay expression={expr.expression} />
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Type: {expr.type}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleExpression(index)}
                    className={`hover:opacity-70 ${expr.visible === false ? 'text-gray-400 opacity-50' : 'text-blue-600'}`}
                    title={`Toggle visibility (${expr.visible === false ? 'hidden' : 'visible'})`}
                  >
                    {expr.visible === false ? '👁️‍🗨️' : '👁️'}
                  </button>
                  <button
                    onClick={() => removeExpression(index)}
                    className="text-red-600 hover:text-red-800"
                    title="Remove expression"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpressionPanel;
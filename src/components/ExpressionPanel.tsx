import { useState, useCallback, useEffect, useRef } from 'react';
import { PlotExpression, NamedVariable } from '../types/expressions';
import { ComplexNumber } from '../types/complex';
import { ExpressionParser } from '../math/parser';
import { ExpressionEvaluator } from '../math/evaluator';
import { HybridPlotter, PlotConfig } from '../math/plotting';
import { getTemplatesByCategory, expressionTemplates, ExpressionTemplate } from '../math/templates';
import { ComplexExpressionDisplay } from './MathJaxRenderer';

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingExpression, setEditingExpression] = useState('');
  const [editingLabel, setEditingLabel] = useState('');
  const [editingColor, setEditingColor] = useState('#4ecdc4');
  const [editingLineThickness, setEditingLineThickness] = useState(2);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showTemplateSuggestions, setShowTemplateSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<ExpressionTemplate[]>([]);
  const [showStylePanel, setShowStylePanel] = useState<number | null>(null);
  const [tempColor, setTempColor] = useState('#4ecdc4');
  const [tempLineThickness, setTempLineThickness] = useState(2);

  const parser = new ExpressionParser();
  const evaluator = new ExpressionEvaluator();
  const plotter = new HybridPlotter(config);

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

  // Helper functions for inline editing
  const startEdit = useCallback((index: number) => {
    const expr = expressions[index];
    setEditingIndex(index);
    setEditingExpression(expr.expression);
    setEditingLabel(expr.label || '');
    setEditingColor(expr.color || '#4ecdc4');
    setEditingLineThickness(expr.lineThickness || 2);
    setParseError(null);
  }, [expressions]);

  const cancelEdit = useCallback(() => {
    setEditingIndex(null);
    setEditingExpression('');
    setEditingLabel('');
    setEditingColor('#4ecdc4');
    setEditingLineThickness(2);
    setParseError(null);
    setShowTemplateSuggestions(false);
  }, []);

  const saveEdit = useCallback(() => {
    if (editingIndex === null) return;

    const cleanExpression = editingExpression.trim();
    if (!cleanExpression) {
      setParseError('Expression cannot be empty');
      return;
    }

    try {
      const result = parser.parseExpressionString(cleanExpression);
      if (result.error) {
        setParseError(result.error);
        return;
      }

      const type = determineExpressionType(cleanExpression);
      const updatedExpressions = [...expressions];
      updatedExpressions[editingIndex] = {
        ...updatedExpressions[editingIndex],
        type,
        expression: cleanExpression,
        originalExpression: cleanExpression,
        color: editingColor,
        label: editingLabel || undefined,
        lineThickness: editingLineThickness
      };

      // Generate plot data
      const currentExpression = updatedExpressions[editingIndex];
      const plotResult = plotter.plotExpression(result.ast, cleanExpression, currentExpression);
      if (plotResult.error) {
        setParseError(`Plotting error: ${plotResult.error}`);
        return;
      }

      setExpressions(updatedExpressions);
      onExpressionsChange(updatedExpressions);
      onPlotGenerated(plotResult);
      closeStylePanel(); // Close any open style panel
      cancelEdit();
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Error saving expression');
    }
  }, [editingIndex, editingExpression, editingLabel, editingColor, editingLineThickness, expressions, parser, plotter, onExpressionsChange, onPlotGenerated, cancelEdit]);

  // Style panel management
  const closeStylePanel = useCallback(() => {
    setShowStylePanel(null);
  }, []);

  const openStylePanel = useCallback((index: number) => {
    const expr = expressions[index];
    setTempColor(expr.color || '#4ecdc4');
    setTempLineThickness(expr.lineThickness || 2);
    setShowStylePanel(index);
  }, [expressions]);

  const applyStyleChanges = useCallback((index: number) => {
    const updatedExpressions = [...expressions];
    const expression = updatedExpressions[index];
    const updatedExpression = {
      ...expression,
      color: tempColor,
      lineThickness: tempLineThickness
    };
    updatedExpressions[index] = updatedExpression;

    setExpressions(updatedExpressions);
    onExpressionsChange(updatedExpressions);

    // Re-plot the expression with new style settings
    try {
      const parser = new ExpressionParser();
      const result = parser.parseExpressionString(expression.expression);

      if (!result.error && expression.expression) {
        const plotResult = plotter.plotExpression(result.ast, expression.expression, updatedExpression);
        if (plotResult.regions && plotResult.regions.length > 0) {
          onPlotGenerated(plotResult);
        }
      }
    } catch (error) {
      console.error('Error re-plotting expression after style change:', error);
    }

    // Also update editing state if this expression is currently being edited
    if (editingIndex === index) {
      setEditingColor(tempColor);
      setEditingLineThickness(tempLineThickness);
    }

    closeStylePanel();
  }, [expressions, tempColor, tempLineThickness, onExpressionsChange, onPlotGenerated, closeStylePanel, editingIndex]);

  // Close style panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showStylePanel !== null) {
        const target = event.target as Element;
        if (!target.closest('.style-panel-container')) {
          closeStylePanel();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStylePanel, closeStylePanel]);

  const addNewExpression = useCallback(() => {
    const newExpr: PlotExpression = {
      type: 'point',
      expression: '',
      originalExpression: '',
      color: '#4ecdc4',
      visible: true
    };

    setExpressions(prevExpressions => {
      const updatedExpressions = [...prevExpressions, newExpr];
      onExpressionsChange(updatedExpressions);

      // Start editing the new expression
      setTimeout(() => {
        setEditingIndex(updatedExpressions.length - 1);
        setEditingExpression('');
        setEditingLabel('');
        setEditingColor('#4ecdc4');
        setEditingLineThickness(2);
        setParseError(null);
      }, 0);

      return updatedExpressions;
    });
  }, [onExpressionsChange]);

  const removeExpression = useCallback((index: number) => {
    const updatedExpressions = expressions.filter((_, i) => i !== index);
    setExpressions(updatedExpressions);
    onExpressionsChange(updatedExpressions);

    // Adjust editing index if necessary
    if (editingIndex !== null && editingIndex >= index) {
      if (editingIndex >= updatedExpressions.length) {
        cancelEdit();
      } else {
        setEditingIndex(editingIndex - 1);
      }
    }
  }, [expressions, editingIndex, onExpressionsChange, cancelEdit]);

  const toggleExpression = useCallback((index: number) => {
    const updatedExpressions = [...expressions];
    const expression = updatedExpressions[index];

    if (expression) {
      expression.visible = expression.visible === false ? true : false;
      onExpressionsChange(updatedExpressions);
    }
  }, [expressions, onExpressionsChange]);

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

  // Template autocomplete functionality
  const handleExpressionChange = useCallback((value: string) => {
    setEditingExpression(value);
    setParseError(null);

    if (value.trim()) {
      // Get all templates for autocomplete
      const allTemplates = expressionTemplates;
      const filtered = allTemplates.filter(template =>
        template.name.toLowerCase().includes(value.toLowerCase()) ||
        template.template.toLowerCase().includes(value.toLowerCase()) ||
        template.description.toLowerCase().includes(value.toLowerCase())
      );
      setFilteredSuggestions(filtered.slice(0, 5)); // Limit to 5 suggestions
      setShowTemplateSuggestions(filtered.length > 0);
    } else {
      setFilteredSuggestions([]);
      setShowTemplateSuggestions(false);
    }
  }, []);

  const applyTemplate = useCallback((template: ExpressionTemplate) => {
    setEditingExpression(template.template);
    setEditingLabel(template.name);
    setShowTemplateSuggestions(false);
    setFilteredSuggestions([]);
  }, []);

  return (
    <div className="h-full flex flex-col expression-panel border-l">
      {/* Fixed header */}
      <div className="px-4 py-3 border-b flex items-center justify-between w-full">
        <h3 className="text-sm font-semibold expression-label flex-shrink-0">Expressions</h3>
        <button
            onClick={addNewExpression}
            className="w-6 h-6 flex items-center justify-center rounded border-2 border-dashed hover:border-solid transition-all duration-200 expression-item text-sm expression-label flex-shrink-0"
            title="Add Expression"
          >
            +
          </button>
      </div>

          {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-2">
  
          {/* Error Display */}
          {parseError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-3 py-2 rounded-lg text-sm">
              {parseError}
            </div>
          )}

          {/* Expressions List */}
          {expressions.map((expr, index) => (
            <div key={index} className="expression-item border rounded-lg">
              {editingIndex === index ? (
                // Edit Mode
                <div className="p-2">
                  <div className="flex gap-1 items-center">
                    <div className="relative">
                      <div
                        className="w-8 h-4 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 bg-white dark:bg-gray-800 flex items-center justify-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStylePanel(index);
                        }}
                        title="Style Settings"
                      >
                        <div className="w-6 h-0.5 bg-current" style={{color: editingColor, height: `${editingLineThickness}px`}}></div>
                      </div>

                      {showStylePanel === index && (
                        <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-48 style-panel-container">
                          <div className="space-y-3">
                            {/* Line Preview */}
                            <div className="flex items-center justify-center py-2">
                              <svg className="w-full h-6" viewBox="0 0 200 24">
                                <line
                                  x1="10"
                                  y1="12"
                                  x2="190"
                                  y2="12"
                                  stroke={tempColor}
                                  strokeWidth={tempLineThickness}
                                  strokeLinecap="round"
                                />
                              </svg>
                            </div>

                            {/* Color Picker */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs font-medium expression-label">Color:</label>
                              <input
                                type="color"
                                value={tempColor}
                                onChange={(e) => setTempColor(e.target.value)}
                                className="w-8 h-8 expression-input border rounded cursor-pointer"
                              />
                            </div>

                            {/* Line Thickness Slider */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-medium expression-label">Thickness:</label>
                                <span className="text-xs expression-label">{tempLineThickness}</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="5"
                                step="1"
                                value={tempLineThickness}
                                onChange={(e) => setTempLineThickness(Number(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                              />
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>1</span>
                                <span>5</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              <button
                                onClick={() => applyStyleChanges(index)}
                                className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                              >
                                Apply
                              </button>
                              <button
                                onClick={closeStylePanel}
                                className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      type="text"
                      value={editingExpression}
                      onChange={(e) => handleExpressionChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEdit();
                        }
                      }}
                      placeholder="Enter expression..."
                      className="expression-input flex-1 px-2 py-1 text-xs border rounded transition-all duration-200"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      placeholder="Label"
                      className="expression-input w-12 px-1 py-1 text-xs border rounded transition-all duration-200"
                    />
                    <button
                      onClick={saveEdit}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-1 py-1 rounded text-xs font-medium transition-all duration-200 border w-4 h-4 flex items-center justify-center"
                    >
                      ✓
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-1 py-1 rounded text-xs font-medium transition-all duration-200 border w-4 h-4 flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Template Suggestions */}
                  {showTemplateSuggestions && filteredSuggestions.length > 0 && (
                    <div className="border rounded-lg p-1 mt-1 bg-white dark:bg-gray-800">
                      {filteredSuggestions.map((template, index) => (
                        <div
                          key={index}
                          onClick={() => applyTemplate(template)}
                          className="px-1 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded"
                        >
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-gray-500">{template.template}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Read Mode
                <div
                  className="flex items-center justify-between p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => startEdit(index)}
                >
                  <div className="relative">
                    <div
                        className="w-8 h-4 border rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 bg-white dark:bg-gray-800 flex items-center justify-center flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openStylePanel(index);
                        }}
                        title="Style Settings"
                      >
                        <div className="w-6 h-0.5 bg-current" style={{color: expr.color || '#4ecdc4', height: `${expr.lineThickness || 2}px`}}></div>
                      </div>

                      {showStylePanel === index && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 min-w-48 style-panel-container">
                        <div className="space-y-3">
                          {/* Line Preview */}
                          <div className="flex items-center justify-center py-2">
                            <svg className="w-full h-6" viewBox="0 0 200 24">
                              <line
                                x1="10"
                                y1="12"
                                x2="190"
                                y2="12"
                                stroke={tempColor}
                                strokeWidth={tempLineThickness}
                                strokeLinecap="round"
                              />
                            </svg>
                          </div>

                          {/* Color Picker */}
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-medium expression-label">Color:</label>
                            <input
                              type="color"
                              value={tempColor}
                              onChange={(e) => setTempColor(e.target.value)}
                              className="w-8 h-8 expression-input border rounded cursor-pointer"
                            />
                          </div>

                          {/* Line Thickness Slider */}
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-medium expression-label">Thickness:</label>
                              <span className="text-xs expression-label">{tempLineThickness}</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="5"
                              step="1"
                              value={tempLineThickness}
                              onChange={(e) => setTempLineThickness(Number(e.target.value))}
                              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>1</span>
                              <span>5</span>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <button
                              onClick={() => applyStyleChanges(index)}
                              className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            >
                              Apply
                            </button>
                            <button
                              onClick={closeStylePanel}
                              className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {expr.label && <span className="font-medium expression-label text-xs">{expr.label}:</span>}
                  <span className="text-xs flex-1">
                    <ComplexExpressionDisplay
                      expression={expr.expression}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpression(index);
                    }}
                    className={`hover:opacity-70 transition-opacity text-xs flex-shrink-0 w-4 h-4 flex items-center justify-center ${expr.visible === false ? 'text-gray-400 opacity-50' : 'text-blue-500'}`}
                    title={`Toggle visibility (${expr.visible === false ? 'hidden' : 'visible'})`}
                  >
                    {expr.visible === false ? '👁️‍🗨️' : '👁️'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeExpression(index);
                    }}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors text-xs flex-shrink-0 w-4 h-4 flex items-center justify-center"
                    title="Remove expression"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Named Variables */}
          {namedVariables.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold expression-label text-sm mb-2">Variables</h4>
              <div className="space-y-1">
                {namedVariables.map(variable => (
                  <div key={variable.name} className="expression-item flex items-center justify-between p-2 border rounded-lg">
                    <div className="text-sm">
                      <span className="font-medium expression-label">{variable.name} = </span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">{variable.expression}</span>
                    </div>
                    <button
                      onClick={() => {
                        setNamedVariables(prev => prev.filter(v => v.name !== variable.name));
                      }}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors text-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpressionPanel;
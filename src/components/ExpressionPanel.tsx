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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  showAllLabels?: boolean;
  onShowAllLabelsChange?: (showAllLabels: boolean) => void;
}

export const ExpressionPanel: React.FC<ExpressionPanelProps> = ({
  onExpressionsChange,
  config,
  onPlotGenerated,
  isCollapsed = false,
  onToggleCollapse,
  showAllLabels = false,
  onShowAllLabelsChange
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
  
  // Function to generate random colors
  const generateRandomColor = useCallback(() => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E74C3C', '#3498DB', '#2ECC71',
      '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

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
      cancelEdit();
    } catch (error) {
      setParseError(error instanceof Error ? error.message : 'Error saving expression');
    }
  }, [editingIndex, editingExpression, editingLabel, editingColor, editingLineThickness, expressions, parser, plotter, onExpressionsChange, onPlotGenerated, cancelEdit]);

  
  const addNewExpression = useCallback(() => {
    const newExpr: PlotExpression = {
      type: 'point',
      expression: '',
      originalExpression: '',
      color: generateRandomColor(),
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
        setEditingColor(newExpr.color);
        setEditingLineThickness(2);
        setParseError(null);
      }, 0);

      return updatedExpressions;
    });
  }, [onExpressionsChange, generateRandomColor]);

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
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => onShowAllLabelsChange?.(!showAllLabels)}
            className={`w-6 h-6 flex items-center justify-center rounded border transition-all duration-200 expression-item text-xs expression-label flex-shrink-0 ${
              showAllLabels
                ? 'border-solid bg-blue-100 border-blue-300'
                : 'border-2 border-dashed hover:border-solid'
            }`}
            title={showAllLabels ? "Hide All Labels" : "Show All Labels"}
          >
            🏷️
          </button>
          <button
            onClick={addNewExpression}
            className="w-6 h-6 flex items-center justify-center rounded border-2 border-dashed hover:border-solid transition-all duration-200 expression-item text-sm expression-label flex-shrink-0"
            title="Add Expression"
          >
            +
          </button>
          <button
            onClick={onToggleCollapse}
            className="w-6 h-6 flex items-center justify-center rounded border hover:border-solid transition-all duration-200 expression-item text-sm expression-label flex-shrink-0"
            title="Collapse"
          >
            ←
          </button>
        </div>
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
                // Edit Mode - Unified interface
                <div className="p-2 space-y-3">
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      value={editingExpression}
                      onChange={(e) => handleExpressionChange(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit();
                        }
                      }}
                      onBlur={saveEdit}
                      placeholder="Enter expression..."
                      className="expression-input flex-1 px-2 py-1 text-xs border rounded transition-all duration-200"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onBlur={saveEdit}
                      placeholder="Label"
                      className="expression-input w-12 px-1 py-1 text-xs border rounded transition-all duration-200"
                    />
                  </div>

                  {/* Style Controls - Always visible in edit mode */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-4 border-2 rounded bg-white dark:bg-gray-800 flex items-center justify-center"
                        style={{ borderColor: editingColor }}
                      >
                        <div
                          className="rounded"
                          style={{
                            width: '16px',
                            backgroundColor: editingColor,
                            height: `${Math.max(editingLineThickness || 2, 4)}px`,
                            minWidth: '16px'
                          }}
                        />
                      </div>
                      <input
                        type="color"
                        value={editingColor}
                        onChange={(e) => setEditingColor(e.target.value)}
                        className="w-8 h-8 expression-input border rounded cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="1"
                        value={editingLineThickness}
                        onChange={(e) => setEditingLineThickness(Number(e.target.value))}
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                      />
                      <span className="text-xs expression-label min-w-4">{editingLineThickness}</span>
                    </div>
                  </div>

                  {/* Template Suggestions */}
                  {showTemplateSuggestions && filteredSuggestions.length > 0 && (
                    <div className="border rounded-lg p-1 bg-white dark:bg-gray-800">
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
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => startEdit(index)}
                >
                  {/* Color indicator bar - full width */}
                  <div
                    className="w-full"
                    style={{
                      height: `${Math.max(expr.lineThickness || 2, 3)}px`,
                      backgroundColor: expr.color || '#4ecdc4',
                      minHeight: '3px'
                    }}
                    title="Color and style indicator"
                  />

                  {/* Content row */}
                  <div className="flex items-center justify-between p-2">
                    {expr.label && <span className="font-medium expression-label text-xs mr-1">{expr.label}:</span>}
                    <span className="text-xs flex-1 whitespace-nowrap">
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
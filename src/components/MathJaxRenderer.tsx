import { useState, useEffect } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathJaxRendererProps {
  expression: string;
  display?: boolean;
  className?: string;
  onRenderComplete?: () => void;
}

// KaTeX renderer for mathematical expressions
export const MathJaxRenderer: React.FC<MathJaxRendererProps> = ({
  expression,
  display = false,
  className = '',
  onRenderComplete
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (onRenderComplete) {
      onRenderComplete();
    }
  }, [expression, onRenderComplete]);

  const { convertToLatex } = useLatexConverter();
  const latexExpression = convertToLatex(expression);

  if (error) {
    return (
      <span className={`math-error ${className}`} title={error}>
        {expression}
      </span>
    );
  }

  try {
    const MathComponent = display ? BlockMath : InlineMath;

    return (
      <span className={`math-expression ${className}`}>
        <MathComponent math={latexExpression} errorColor={'#cc0000'} />
      </span>
    );
  } catch (err) {
    return (
      <span className={`math-error ${className}`} title="Rendering error">
        {expression}
      </span>
    );
  }
};

// Hook for converting mathematical expressions to LaTeX
export const useLatexConverter = () => {
  const convertToLatex = (expression: string): string => {
    let latex = expression;

    // Replace complex number notation first
    latex = latex.replace(/(\d+)i/g, '$1i');
    latex = latex.replace(/\bi\b/g, 'i');

    // Replace inequalities before processing modulus to avoid conflicts
    latex = latex.replace(/<=/g, ' \\leq ');
    latex = latex.replace(/>=/g, ' \\geq ');
    latex = latex.replace(/!=/g, ' \\neq ');
    latex = latex.replace(/==/g, ' = ');
    latex = latex.replace(/=/g, ' = ');

    // Replace common functions before modulus processing
    latex = latex.replace(/\bRe\(/g, '\\operatorname{Re}(');
    latex = latex.replace(/\bIm\(/g, '\\operatorname{Im}(');
    latex = latex.replace(/\barg\(/g, '\\arg(');
    latex = latex.replace(/\babs\(/g, '\\left|');
    latex = latex.replace(/\bconj\(/g, '\\overline{');
    latex = latex.replace(/\bexp\(/g, 'e^{');
    latex = latex.replace(/\blog\(/g, '\\ln(');
    latex = latex.replace(/\bsin\(/g, '\\sin(');
    latex = latex.replace(/\bcos\(/g, '\\cos(');
    latex = latex.replace(/\btan\(/g, '\\tan(');
    latex = latex.replace(/\bsqrt\(/g, '\\sqrt{');

    // Handle modulus (absolute value) properly - convert to LaTeX notation
    // Stack-based approach for nested modulus
    const modulusStack: number[] = [];
    let result = '';
    let i = 0;

    while (i < latex.length) {
      if (latex[i] === '|') {
        // If this is an opening bar (no matching closing bar found yet)
        let hasMatchingClosing = false;
        let tempDepth = 1;

        for (let j = i + 1; j < latex.length; j++) {
          if (latex[j] === '|') {
            tempDepth--;
            if (tempDepth === 0) {
              hasMatchingClosing = true;
              break;
            }
          }
        }

        if (hasMatchingClosing && modulusStack.length === 0) {
          // This is an opening bar
          modulusStack.push(i);
          result += '\\left|';
        } else if (modulusStack.length > 0) {
          // This is a closing bar
          modulusStack.pop();
          result += '\\right|';
        } else {
          // Unmatched bar, just add it
          result += '|';
        }
        i++;
      } else {
        result += latex[i];
        i++;
      }
    }
    latex = result;

    // Handle complex numbers with i
    latex = latex.replace(/([a-zA-Z])i/g, '$1i');
    latex = latex.replace(/(\d)i/g, '$1i');

    // Clean up extra spaces around braces
    latex = latex.replace(/\\{\s*/g, '\\{');
    latex = latex.replace(/\s*\\}/g, '\\}');

    // Clean up multiple spaces
    latex = latex.replace(/\s+/g, ' ').trim();

    return latex;
  };

  const simplifyExpression = (expression: string): string => {
    let simplified = expression;

    // Add proper spacing around operators
    simplified = simplified.replace(/([0-9])([a-zA-Z])/g, '$1 \\cdot $2');
    simplified = simplified.replace(/([a-zA-Z])([0-9])/g, '$1^{\\text{$2}}');

    return simplified;
  };

  return { convertToLatex, simplifyExpression };
};

// Component for displaying complex expressions with proper formatting using KaTeX
export const ComplexExpressionDisplay: React.FC<{
  expression: string;
  className?: string;
  simplify?: boolean;
  display?: boolean;
}> = ({ expression, className = '', simplify = false, display = false }) => {
  const { convertToLatex, simplifyExpression } = useLatexConverter();

  const latexExpression = simplify
    ? simplifyExpression(convertToLatex(expression))
    : convertToLatex(expression);

  try {
    const MathComponent = display ? BlockMath : InlineMath;

    return (
      <span className={`complex-expression ${className}`}>
        <MathComponent
          math={latexExpression}
          errorColor={'#cc0000'}
          renderError={(error) => {
            return <span className="text-red-500" title={error.message}>{expression}</span>;
          }}
        />
      </span>
    );
  } catch (err) {
    return (
      <span className={`complex-expression ${className} text-red-500`} title="Rendering error">
        {expression}
      </span>
    );
  }
};

export default MathJaxRenderer;
import { useState } from 'react';

interface MathJaxRendererProps {
  expression: string;
  display?: boolean;
  className?: string;
  onRenderComplete?: () => void;
}

// Simple MathJax renderer that falls back to plain text for now
export const MathJaxRenderer: React.FC<MathJaxRendererProps> = ({
  expression,
  display = false,
  className = '',
  onRenderComplete
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For now, just return the expression as-is to avoid MathJax loading issues
  // MathJax can be added later as an enhancement
  if (error) {
    return (
      <span className={`math-error ${className}`} title={error}>
        {expression}
      </span>
    );
  }

  return (
    <span
      className={`math-expression ${className}`}
      style={{
        display: display ? 'block' : 'inline',
        fontFamily: 'Cambria Math, STIX Two Math, serif',
        fontSize: display ? '1.1em' : '1em'
      }}
    >
      {expression}
    </span>
  );
};

// Hook for converting mathematical expressions to LaTeX
export const useLatexConverter = () => {
  const convertToLatex = (expression: string): string => {
    let latex = expression;

    // Replace complex number notation
    latex = latex.replace(/(\d+)i/g, '$1i');
    latex = latex.replace(/\bi\b/g, 'i');

    // Handle modulus (absolute value) properly - this is more complex
    // We need to pair opening and closing bars
    const modulusPairs: number[] = [];
    let barCount = 0;

    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === '|') {
        modulusPairs.push(i);
        barCount++;
      }
    }

    // Replace bars in pairs
    let result = '';
    let pairIndex = 0;
    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === '|') {
        if (pairIndex % 2 === 0) {
          result += '\\left|';
        } else {
          result += '\\right|';
        }
        pairIndex++;
      } else {
        result += latex[i];
      }
    }
    latex = result;

    // Replace common functions
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

    // Replace power operator
    latex = latex.replace(/\^/g, '^');

    // Replace inequalities with proper spacing
    latex = latex.replace(/<=/g, '\\leq');
    latex = latex.replace(/>=/g, '\\geq');
    latex = latex.replace(/!=/g, '\\neq');
    latex = latex.replace(/==/g, '=');

    // Handle complex numbers with i
    latex = latex.replace(/([a-zA-Z])i/g, '$1i');

    // Fix function calls
    latex = latex.replace(/(\w+)\{/g, '$1\\{');
    latex = latex.replace(/\}([^\s])/g, '\\}$1');

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

// Component for displaying complex expressions with proper formatting
export const ComplexExpressionDisplay: React.FC<{
  expression: string;
  className?: string;
  simplify?: boolean;
}> = ({ expression, className = '', simplify = false }) => {
  const { convertToLatex, simplifyExpression } = useLatexConverter();

  const latexExpression = simplify
    ? simplifyExpression(convertToLatex(expression))
    : convertToLatex(expression);

  return (
    <span
      className={`complex-expression ${className}`}
      style={{
        fontFamily: 'Cambria Math, STIX Two Math, serif',
        fontSize: '1em'
      }}
    >
      {latexExpression}
    </span>
  );
};

export default MathJaxRenderer;
import { ExpressionTemplate } from '../types/expressions';

export const expressionTemplates: ExpressionTemplate[] = [
  // Point templates
  {
    name: 'Complex Number',
    description: 'Enter a complex number as a+bi',
    template: 'a + bi',
    category: 'point',
    examples: ['2 + 3i', '-1 + i', '4i', '3', '2.5 - 1.5i']
  },
  {
    name: 'Named Point',
    description: 'Define a named complex point',
    template: 'A = a + bi',
    category: 'point',
    examples: ['A = 1 + i', 'B = -2 + 3i', 'O = 0']
  },

  // Equality templates
  {
    name: 'Point on Line',
    description: 'Line passing through complex number',
    template: 'z = a + bi',
    category: 'equality',
    examples: ['z = 1 + i', 'z = -2', 'z = 3i']
  },
  {
    name: 'Circle Equation',
    description: 'Circle with radius and center',
    template: '|z - (a + bi)| = r',
    category: 'equality',
    examples: ['|z - 2| = 3', '|z - (1 + i)| = 2', '|z + i| = 1']
  },
  {
    name: 'Perpendicular Bisector',
    description: 'Perpendicular bisector of segment',
    template: '|z - (a + bi)| = |z - (c + di)|',
    category: 'equality',
    examples: ['|z - 1| = |z + 1|', '|z - i| = |z + i|', '|z - (1 + i)| = |z - (1 - i)|']
  },

  // Inequality templates
  {
    name: 'Inside Circle',
    description: 'All points inside a circle',
    template: '|z - (a + bi)| <= r',
    category: 'inequality',
    examples: ['|z - 2| <= 3', '|z - (1 + i)| <= 2', '|z + i| <= 1']
  },
  {
    name: 'Outside Circle',
    description: 'All points outside a circle',
    template: '|z - (a + bi)| >= r',
    category: 'inequality',
    examples: ['|z - 2| >= 3', '|z - (1 + i)| >= 2', '|z + i| >= 1']
  },
  {
    name: 'Ring Region',
    description: 'Points between two circles',
    template: 'r1 <= |z - (a + bi)| <= r2',
    category: 'inequality',
    examples: ['1 <= |z| <= 2', '1 <= |z - (1 + i)| <= 3', '0.5 <= |z + i| <= 1.5']
  },
  {
    name: 'Half Plane',
    description: 'Half-plane defined by real part',
    template: 'Re(z) > a',
    category: 'inequality',
    examples: ['Re(z) > 0', 'Re(z) < 2', 'Re(z) >= -1', 'Re(z) <= 1']
  },
  {
    name: 'Imaginary Half Plane',
    description: 'Half-plane defined by imaginary part',
    template: 'Im(z) > a',
    category: 'inequality',
    examples: ['Im(z) > 0', 'Im(z) < 2', 'Im(z) >= -1', 'Im(z) <= 1']
  },
  {
    name: 'Quadratic Inequality',
    description: 'Quadratic polynomial inequality',
    template: '|z^2 + az + b| <= r',
    category: 'inequality',
    examples: ['|z^2 + 1| <= 1', '|z^2 - 2z + 1| <= 2', '|z^2 + z + 1| <= 1']
  },
  {
    name: 'Cubic Inequality',
    description: 'Cubic polynomial inequality',
    template: '|z^3 + az^2 + bz + c| <= r',
    category: 'inequality',
    examples: ['|z^3 - 1| <= 1', '|z^3 + z^2 + z + 1| <= 2']
  },

  // Function templates
  {
    name: 'Modulus Function',
    description: 'Modulus of complex expression',
    template: '|f(z)|',
    category: 'function',
    examples: ['|z + 1|', '|z^2 - 1|', '|exp(z)|', '|log(z + 1)|']
  },
  {
    name: 'Real Part Function',
    description: 'Real part of complex expression',
    template: 'Re(f(z))',
    category: 'function',
    examples: ['Re(z)', 'Re(z^2)', 'Re(exp(z))', 'Re(log(z))']
  },
  {
    name: 'Imaginary Part Function',
    description: 'Imaginary part of complex expression',
    template: 'Im(f(z))',
    category: 'function',
    examples: ['Im(z)', 'Im(z^2)', 'Im(exp(z))', 'Im(log(z))']
  },
  {
    name: 'Argument Function',
    description: 'Argument of complex expression',
    template: 'arg(f(z))',
    category: 'function',
    examples: ['arg(z)', 'arg(z^2)', 'arg(z - 1)']
  },
  {
    name: 'Exponential Function',
    description: 'Exponential of complex number',
    template: 'exp(f(z))',
    category: 'function',
    examples: ['exp(z)', 'exp(z^2)', 'exp(iz)']
  },
  {
    name: 'Logarithm Function',
    description: 'Logarithm of complex number',
    template: 'log(f(z))',
    category: 'function',
    examples: ['log(z)', 'log(z + 1)', 'log(z - i)']
  },
  {
    name: 'Trigonometric Functions',
    description: 'Trigonometric functions',
    template: 'sin(z), cos(z), tan(z)',
    category: 'function',
    examples: ['sin(z)', 'cos(z)', 'tan(z)', 'sin(z^2)']
  },

  // Advanced templates
  {
    name: 'Modulus Sum',
    description: 'Sum of distances to two points',
    template: '|z - (a + bi)| + |z - (c + di)| = r',
    category: 'equality',
    examples: ['|z - 1| + |z + 1| = 4', '|z - i| + |z + i| = 3']
  },
  {
    name: 'Modulus Difference',
    description: 'Difference of distances to two points',
    template: '| |z - (a + bi)| - |z - (c + di)| | = r',
    category: 'equality',
    examples: ['| |z - 3| - |z + 3| | = 2', '| |z - 2i| - |z + 2i| | = 1']
  },
  {
    name: 'Product of Distances',
    description: 'Product of distances to multiple points',
    template: '|z - (a + bi)| * |z - (c + di)| = r',
    category: 'equality',
    examples: ['|z - 1| * |z + 1| = 1', '|z - i| * |z + i| = 2']
  }
];

export const getTemplatesByCategory = (category: string): ExpressionTemplate[] => {
  return expressionTemplates.filter(template => template.category === category);
};

export const searchTemplates = (query: string): ExpressionTemplate[] => {
  const lowerQuery = query.toLowerCase();
  return expressionTemplates.filter(template =>
    template.name.toLowerCase().includes(lowerQuery) ||
    template.description.toLowerCase().includes(lowerQuery) ||
    template.template.toLowerCase().includes(lowerQuery)
  );
};

export const getTemplateByExample = (example: string): ExpressionTemplate | undefined => {
  return expressionTemplates.find(template =>
    template.examples?.some(ex => ex.toLowerCase() === example.toLowerCase())
  );
};

export type { ExpressionTemplate };
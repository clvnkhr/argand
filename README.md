# Advanced Argand Diagram Plotter

A sophisticated web application for plotting complex mathematical expressions, points, curves, and inequalities in the complex plane (Argand diagram) with advanced parsing and LaTeX rendering.

## 🚀 Features

### Mathematical Expression Support

- **Advanced Parser**: Support for complex polynomial expressions with LaTeX formatting
- **Expression Types**:
  - Points: `2 + 3i`, `A = 1 + i` (named points)
  - Equalities: `z = 2`, `|z|^2 + |z-2| = 1`
  - Inequalities: `|z^2 + 1| <= 1`, `Re(z) > 0`
- **Complex Functions**: sin, cos, tan, exp, log, sqrt, conjugate, modulus, argument
- **Complex Coefficients**: Support for complex numbers in coefficients
- **Named Variables**: Store and reference complex numbers (like `A`, `B`, etc.)

### Visualization Features

- **Hybrid Plotting System**: Combines boundary tracing and grid sampling for accuracy
- **MathJax Integration**: Beautiful LaTeX mathematical notation rendering
- **Real-time Preview**: Live LaTeX preview as you type expressions
- **Expression Templates**: Library of common mathematical patterns
- **Adaptive Sampling**: Intelligent resolution adjustment for complex regions
- **Interactive Elements**: Hover tooltips, color customization, labels

### Technical Architecture

- **Bun Package Manager**: Fast package management and execution
- **TypeScript**: Type-safe development with comprehensive interfaces
- **React**: Modern UI with hooks and state management
- **SVG Rendering**: High-quality mathematical graphics
- **Comprehensive Testing**: Unit tests for math functions and parser

## 📖 How to Use

### Mathematical Expressions

Enter complex mathematical expressions using natural mathematical notation:

#### Points and Variables

```
2 + 3i                    # Plot point 2+3i
A = 1 + i                # Define named point A
B = -2 + 3i              # Define named point B
```

#### Equalities and Curves

```
z = 2                    # Line at z=2
|z - (1 + i)| = 2        # Circle centered at 1+i with radius 2
|z - 1| = |z + 1|        # Perpendicular bisector
|z|^2 + |z-2| = 1        # Complex curve
```

#### Inequalities and Regions

```
|z^2 + 1| <= 1          # Points satisfying |z²+1| ≤ 1
Re(z) > 0               # Right half-plane
Im(z) < 2               # Below horizontal line
1 <= |z| <= 2           # Annular region
|z - (a + bi)| <= r      # Circle inequality template
```

#### Complex Functions

```
sin(z), cos(z), tan(z)   # Trigonometric functions
exp(z), log(z)           # Exponential and logarithm
sqrt(z)                  # Square root
conj(z)                  # Complex conjugate
|z|, arg(z), Re(z), Im(z) # Modulus, argument, real/imaginary parts
```

### Template Library

Use the expression templates for common patterns:

- **Point Templates**: Complex numbers, named points
- **Equality Templates**: Lines, circles, bisectors
- **Inequality Templates**: Regions, half-planes, rings
- **Function Templates**: Mathematical functions

### Interface Features

- **Real-time LaTeX Preview**: See beautifully formatted expressions as you type
- **Color Customization**: Choose colors for each expression
- **Named Variables**: Define and reuse complex numbers
- **Expression Management**: Toggle visibility, remove individual expressions
- **Error Handling**: Clear syntax error messages and validation

## 🛠️ Development

### Local Development

```bash
# Install dependencies with Bun
bun install

# Start development server
bun run dev

# Run tests
bun run test

# Run tests with coverage
bun run test:coverage

# Build for production
bun run build
```

### Testing

The project includes comprehensive unit tests:

- **Complex Number Utilities**: Arithmetic operations, conversions
- **Expression Parser**: Tokenization, AST generation, error handling
- **Expression Evaluator**: Mathematical function evaluation, complex arithmetic
- **Integration Tests**: End-to-end functionality testing

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/math/parser.test.ts

# Run with watch mode
bun test:watch
```

### Technology Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Language**: TypeScript with strict type checking
- **Frontend**: React 18 with hooks and functional components
- **Build Tool**: Vite for fast development and optimized builds
- **Mathematical Rendering**: MathJax for LaTeX formatting
- **Testing**: Bun's built-in test runner
- **Deployment**: GitHub Pages integration

## 📊 Architecture

### Core Components

#### Math Engine

- **Parser** (`src/math/parser.ts`): Tokenizes and parses mathematical expressions
- **Evaluator** (`src/math/evaluator.ts`): Evaluates complex mathematical expressions
- **Plotter** (`src/math/plotting.ts`): Hybrid plotting with boundary tracing and grid sampling
- **Templates** (`src/math/templates.ts`): Library of expression templates

#### UI Components

- **ExpressionPanel**: Advanced expression input with LaTeX preview
- **ArgandDiagram**: Enhanced diagram rendering with plot regions
- **MathJaxRenderer**: LaTeX mathematical notation display

#### Type System

- **Complex Types**: Comprehensive interfaces for complex numbers and expressions
- **Expression Types**: Support for points, equalities, inequalities, functions
- **Plot Types**: Regions, boundaries, adaptive sampling configurations

### Performance Optimizations

- **Adaptive Sampling**: Intelligent resolution adjustment
- **Hybrid Plotting**: Boundary tracing for polynomials, grid sampling fallback
- **Type Safety**: Compile-time error prevention
- **Lazy Loading**: On-demand mathematical function loading

## 🚀 Deployment to GitHub Pages

1. Update the `[USERNAME]` placeholder in `package.json` with your GitHub username
2. Push to your GitHub repository
3. Run deployment script:

```bash
bun run deploy
```

## 🧮 Mathematical Background

An Argand diagram represents complex numbers in a coordinate plane where:

- **Real axis** (horizontal): Represents the real part of complex numbers
- **Imaginary axis** (vertical): Represents the imaginary part
- **Complex number** `z = a + bi` is plotted as the point `(a, b)`

### Supported Mathematical Concepts

#### Complex Functions

- **Modulus**: `|z| = √(a² + b²)` - distance from origin
- **Argument**: `arg(z) = arctan(b/a)` - angle from positive real axis
- **Conjugate**: `z̄ = a - bi` - reflection across real axis
- **Exponential**: `e^(a+bi) = e^a(cos(b) + i·sin(b))`

#### Regions and Inequalities

- **Circles**: `|z - (x₀ + iy₀)| = r` - set of points at distance r from center
- **Half-planes**: `Re(z) > 0`, `Im(z) < 2` - regions defined by linear constraints
- **Annular regions**: `r₁ ≤ |z - c| ≤ r₂` - regions between two circles

This advanced implementation provides a powerful tool for visualizing complex mathematical concepts with professional-grade mathematical notation and precise plotting capabilities.

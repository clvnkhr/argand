import { useState } from 'react';
import { Point, Curve, Inequality, PlotElement } from '../types/complex';

interface InputPanelProps {
  onElementsChange: (elements: PlotElement[]) => void;
}

const InputPanel: React.FC<InputPanelProps> = ({ onElementsChange }) => {
  const [currentElements, setCurrentElements] = useState<PlotElement[]>([]);
  const [pointInput, setPointInput] = useState({ x: '', y: '', label: '', color: '#ff6b6b' });
  const [inequalityInput, setInequalityInput] = useState({
    centerReal: '',
    centerImag: '',
    radius: '',
    label: '',
    color: '#95e77e'
  });

  const addPoint = () => {
    const x = parseFloat(pointInput.x);
    const y = parseFloat(pointInput.y);

    if (!isNaN(x) && !isNaN(y)) {
      const newPoint: Point = {
        x,
        y,
        label: pointInput.label || undefined,
        color: pointInput.color
      };

      const newElements = [...currentElements, newPoint];
      setCurrentElements(newElements);
      onElementsChange(newElements);
      setPointInput({ x: '', y: '', label: '', color: '#ff6b6b' });
    }
  };

  const addInequality = () => {
    const centerReal = parseFloat(inequalityInput.centerReal);
    const centerImag = parseFloat(inequalityInput.centerImag);
    const radius = parseFloat(inequalityInput.radius);

    if (!isNaN(centerReal) && !isNaN(centerImag) && !isNaN(radius) && radius > 0) {
      const newInequality: Inequality = {
        type: 'circle',
        center: { real: centerReal, imaginary: centerImag },
        radius,
        label: inequalityInput.label || undefined,
        color: inequalityInput.color
      };

      const newElements = [...currentElements, newInequality];
      setCurrentElements(newElements);
      onElementsChange(newElements);
      setInequalityInput({ centerReal: '', centerImag: '', radius: '', label: '', color: '#95e77e' });
    }
  };

  const generateSpiral = () => {
    const points: Point[] = [];
    for (let t = 0; t <= 4 * Math.PI; t += 0.1) {
      const r = t;
      const x = r * Math.cos(t);
      const y = r * Math.sin(t);
      points.push({ x, y });
    }

    const newCurve: Curve = {
      points,
      color: '#4ecdc4',
      label: 'Spiral'
    };

    const newElements = [...currentElements, newCurve];
    setCurrentElements(newElements);
    onElementsChange(newElements);
  };

  const clearAll = () => {
    setCurrentElements([]);
    onElementsChange([]);
  };

  return (
    <div className="input-panel p-4 bg-gray-50 border rounded">
      <h3 className="text-lg font-semibold mb-4">Add Elements</h3>

      {/* Point Input */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Add Point</h4>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            placeholder="Real part (x)"
            value={pointInput.x}
            onChange={(e) => setPointInput({ ...pointInput, x: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="number"
            placeholder="Imaginary part (y)"
            value={pointInput.y}
            onChange={(e) => setPointInput({ ...pointInput, y: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="text"
            placeholder="Label (optional)"
            value={pointInput.label}
            onChange={(e) => setPointInput({ ...pointInput, label: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="color"
            value={pointInput.color}
            onChange={(e) => setPointInput({ ...pointInput, color: e.target.value })}
            className="border rounded px-2 py-1 h-8"
          />
        </div>
        <button
          onClick={addPoint}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full"
        >
          Add Point
        </button>
      </div>

      {/* Inequality Input */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Add Circle Inequality</h4>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            placeholder="Center real part"
            value={inequalityInput.centerReal}
            onChange={(e) => setInequalityInput({ ...inequalityInput, centerReal: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="number"
            placeholder="Center imaginary part"
            value={inequalityInput.centerImag}
            onChange={(e) => setInequalityInput({ ...inequalityInput, centerImag: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="number"
            placeholder="Radius"
            value={inequalityInput.radius}
            onChange={(e) => setInequalityInput({ ...inequalityInput, radius: e.target.value })}
            className="border rounded px-2 py-1"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={inequalityInput.label}
            onChange={(e) => setInequalityInput({ ...inequalityInput, label: e.target.value })}
            className="border rounded px-2 py-1"
          />
        </div>
        <input
          type="color"
          value={inequalityInput.color}
          onChange={(e) => setInequalityInput({ ...inequalityInput, color: e.target.value })}
          className="border rounded px-2 py-1 h-8 w-full mb-2"
        />
        <button
          onClick={addInequality}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 w-full"
        >
          Add Circle
        </button>
      </div>

      {/* Preset Curves */}
      <div className="mb-6">
        <h4 className="font-medium mb-2">Preset Curves</h4>
        <button
          onClick={generateSpiral}
          className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 w-full mb-2"
        >
          Add Spiral
        </button>
      </div>

      {/* Clear Button */}
      <button
        onClick={clearAll}
        className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 w-full"
      >
        Clear All
      </button>
    </div>
  );
};

export default InputPanel;
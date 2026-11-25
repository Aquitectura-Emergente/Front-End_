import { workerName, workerNameMap } from './worker-name';

describe('workerNameMap / workerName', () => {
  const names = workerNameMap([
    { id: 14, name: 'Carlos Rojas' },
    { id: 41, name: '  Lucía Mendoza ' },
    { id: 50, name: '' },
  ]);

  it('cruza el workerId con el nombre del operario', () => {
    expect(workerName(14, names)).toBe('Carlos Rojas');
  });

  it('recorta espacios del nombre', () => {
    expect(workerName(41, names)).toBe('Lucía Mendoza');
  });

  // Un operario que el SSO no ve (o si la lista falló) no deja la celda vacía.
  it('sin nombre conocido muestra el id', () => {
    expect(workerName(99, names)).toBe('#99');
    expect(workerName(50, names)).toBe('#50');
  });

  it('sin workerId muestra un guion', () => {
    expect(workerName(undefined, names)).toBe('—');
    expect(workerName(null, names)).toBe('—');
  });
});

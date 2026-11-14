import {
  PlantZone,
  canDeleteZone,
  isAwaitingEdge,
  zoneDeletionBlocker,
} from './plant-zone.model';

function zone(overrides: Partial<PlantZone> = {}): PlantZone {
  return {
    id: 1,
    organizationId: 8,
    name: 'Área de Carga',
    description: null,
    createdAt: '2026-11-01T08:00:00',
    edgeSerialNumber: null,
    edgeStatus: null,
    deviceCount: 0,
    jobPositionCount: 0,
    ...overrides,
  };
}

describe('zoneDeletionBlocker', () => {
  it('no bloquea una zona vacia y sin edge', () => {
    expect(zoneDeletionBlocker(zone())).toBeNull();
    expect(canDeleteZone(zone())).toBe(true);
  });

  it('bloquea por el edge declarado', () => {
    expect(zoneDeletionBlocker(zone({ edgeSerialNumber: 'EDGE-01' }))).toBe('edge');
    expect(canDeleteZone(zone({ edgeSerialNumber: 'EDGE-01' }))).toBe(false);
  });

  it('bloquea por los puestos de trabajo', () => {
    expect(zoneDeletionBlocker(zone({ jobPositionCount: 2 }))).toBe('positions');
  });

  it('bloquea por los dispositivos instalados', () => {
    expect(zoneDeletionBlocker(zone({ deviceCount: 3 }))).toBe('devices');
  });

  // El backend comprueba el edge primero, asi que es el mensaje que el usuario
  // veria si lo intentara. Mostrar otro seria mentirle sobre la causa.
  it('prioriza el edge sobre el resto, igual que el backend', () => {
    const blocked = zone({ edgeSerialNumber: 'EDGE-01', jobPositionCount: 2, deviceCount: 5 });
    expect(zoneDeletionBlocker(blocked)).toBe('edge');
  });
});

describe('isAwaitingEdge', () => {
  it('avisa cuando la zona no tiene edge', () => {
    expect(isAwaitingEdge(zone())).toBe(true);
  });

  it('no avisa cuando ya hay edge, aunque este inactivo', () => {
    expect(isAwaitingEdge(zone({ edgeSerialNumber: 'EDGE-01', edgeStatus: 'INACTIVE' }))).toBe(false);
  });

  // El backend tiene default-property-inclusion=non_null, asi que cuando no hay
  // edge el campo NO llega como null: no llega. Verificado contra la API real.
  // Con una comparacion `=== null` esto devolvia false y la zona no se marcaba.
  it('avisa tambien cuando el campo viene ausente, no nulo', () => {
    const sinCampo = zone();
    delete (sinCampo as Partial<PlantZone>).edgeSerialNumber;
    expect(isAwaitingEdge(sinCampo)).toBe(true);
  });

  it('el bloqueo de borrado tambien tolera el campo ausente', () => {
    const sinCampo = zone({ jobPositionCount: 1 });
    delete (sinCampo as Partial<PlantZone>).edgeSerialNumber;
    expect(zoneDeletionBlocker(sinCampo)).toBe('positions');
  });
});

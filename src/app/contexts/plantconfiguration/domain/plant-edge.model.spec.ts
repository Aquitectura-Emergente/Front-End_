import {
  PlantEdge,
  canActivate,
  canDeactivate,
  zonesWithoutEdge,
} from './plant-edge.model';

function edge(overrides: Partial<PlantEdge> = {}): PlantEdge {
  return {
    id: 1,
    plantZoneId: 10,
    plantZoneName: 'Área de Carga',
    serialNumber: 'EDGE-PLANTA-01',
    status: 'ACTIVE',
    createdAt: '2026-11-01T08:00:00',
    ...overrides,
  };
}

describe('zonesWithoutEdge', () => {
  const zones = [{ id: 10 }, { id: 11 }, { id: 12 }];

  it('deja fuera las zonas que ya tienen edge', () => {
    const libres = zonesWithoutEdge(zones, [edge({ plantZoneId: 11 })]);
    expect(libres.map(z => z.id)).toEqual([10, 12]);
  });

  it('devuelve todas cuando no hay ningun edge declarado', () => {
    expect(zonesWithoutEdge(zones, []).map(z => z.id)).toEqual([10, 11, 12]);
  });

  it('devuelve vacio cuando todas estan ocupadas', () => {
    const edges = zones.map((z, i) => edge({ id: i, plantZoneId: z.id }));
    expect(zonesWithoutEdge(zones, edges)).toEqual([]);
  });
});

describe('canActivate / canDeactivate', () => {
  it('un edge activo solo se puede desactivar', () => {
    const activo = edge({ status: 'ACTIVE' });
    expect(canActivate(activo)).toBe(false);
    expect(canDeactivate(activo)).toBe(true);
  });

  it('un edge inactivo solo se puede activar', () => {
    const inactivo = edge({ status: 'INACTIVE' });
    expect(canActivate(inactivo)).toBe(true);
    expect(canDeactivate(inactivo)).toBe(false);
  });
});

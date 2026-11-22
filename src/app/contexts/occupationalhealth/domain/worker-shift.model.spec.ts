import {
  WorkerPlacement,
  WorkerShift,
  canCloseShift,
  canStartShift,
  groupByZone,
  isOnShift,
  positionsOfZone,
} from './worker-shift.model';

function shift(zoneId: number | null): WorkerShift {
  return {
    id: 1,
    workerId: 16,
    shiftDate: '2026-11-13',
    state: 'ACTIVE',
    currentPlantZoneId: zoneId,
    currentJobPositionId: 1,
    assignments: [],
  };
}

function placement(id: number, name: string, zoneId: number | null): WorkerPlacement {
  return { workerId: id, name, initials: 'XX', shift: zoneId === null ? null : shift(zoneId) };
}

const zones = [
  { id: 32, name: 'Nave de Hornos' },
  { id: 33, name: 'Linea de Soldadura' },
  { id: 34, name: 'Sala de Control' },
];

describe('groupByZone', () => {
  it('coloca a cada operario en su zona', () => {
    const { occupancy } = groupByZone(
      [placement(16, 'Rosa', 32), placement(17, 'Julio', 33)],
      zones,
    );
    expect(occupancy.find(o => o.plantZoneId === 32)!.workers.map(w => w.name)).toEqual(['Rosa']);
    expect(occupancy.find(o => o.plantZoneId === 33)!.workers.map(w => w.name)).toEqual(['Julio']);
  });

  // Una zona sin nadie es informacion util para el responsable, no un hueco que
  // esconder: puede significar que un turno no se cubrio.
  it('devuelve tambien las zonas vacias', () => {
    const { occupancy } = groupByZone([placement(16, 'Rosa', 32)], zones);
    expect(occupancy).toHaveLength(3);
    expect(occupancy.find(o => o.plantZoneId === 34)!.workers).toEqual([]);
  });

  // El backend responde 404 cuando no hay turno abierto, asi que la ausencia es
  // un caso normal y no un error. Verificado en vivo con el operario 15.
  it('aparta a quien no tiene turno abierto', () => {
    const { occupancy, unassigned } = groupByZone(
      [placement(15, 'Pedro', null), placement(16, 'Rosa', 32)],
      zones,
    );
    expect(unassigned.map(w => w.name)).toEqual(['Pedro']);
    expect(occupancy.flatMap(o => o.workers)).toHaveLength(1);
  });

  it('aparta a quien tiene turno pero sin zona', () => {
    const { unassigned } = groupByZone([placement(16, 'Rosa', null)], zones);
    expect(unassigned).toHaveLength(1);
  });

  it('aparta a quien esta en una zona que ya no existe', () => {
    const { occupancy, unassigned } = groupByZone([placement(16, 'Rosa', 999)], zones);
    expect(unassigned.map(w => w.name)).toEqual(['Rosa']);
    expect(occupancy.flatMap(o => o.workers)).toEqual([]);
  });
});

describe('isOnShift', () => {
  it('con zona asignada esta en planta', () => {
    expect(isOnShift(placement(16, 'Rosa', 32))).toBe(true);
  });

  it('sin turno no esta en planta', () => {
    expect(isOnShift(placement(15, 'Pedro', null))).toBe(false);
  });
});

// Un operario no puede estar en dos sitios: el backend rechaza abrir un segundo
// turno, asi que ofrecer el boton seria ofrecer un error.
describe('canStartShift / canCloseShift', () => {
  it('a quien no tiene turno se le puede abrir', () => {
    expect(canStartShift(placement(15, 'Pedro', null))).toBe(true);
    expect(canCloseShift(placement(15, 'Pedro', null))).toBe(false);
  });

  it('a quien ya esta en planta solo se le puede cerrar', () => {
    expect(canStartShift(placement(16, 'Rosa', 32))).toBe(false);
    expect(canCloseShift(placement(16, 'Rosa', 32))).toBe(true);
  });

  // Turno abierto pero sin zona cuenta como fuera de planta en el mapa, y aqui
  // tiene que decidir lo mismo: las dos reglas salen de isOnShift a proposito.
  it('turno sin zona se trata como fuera de planta', () => {
    expect(canStartShift(placement(16, 'Rosa', null))).toBe(true);
  });
});

describe('positionsOfZone', () => {
  const positions = [
    { id: 1, plantZoneId: 32 },
    { id: 2, plantZoneId: 32 },
    { id: 3, plantZoneId: 33 },
  ];

  it('un puesto pertenece a una sola zona', () => {
    expect(positionsOfZone(positions, 32).map(p => p.id)).toEqual([1, 2]);
  });

  // Sin zona elegida no hay puestos validos todavia: el desplegable sale vacio
  // en vez de ofrecer una combinacion que el backend rechazaria.
  it('sin zona no ofrece ninguno', () => {
    expect(positionsOfZone(positions, null)).toEqual([]);
  });

  it('una zona sin puestos no ofrece ninguno', () => {
    expect(positionsOfZone(positions, 34)).toEqual([]);
  });
});

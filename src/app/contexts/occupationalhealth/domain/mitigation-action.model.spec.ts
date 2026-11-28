import {
  AffectedWorker,
  MitigationAction,
  MitigationState,
  isPending,
  needsTarget,
  stateLabelKey,
  validateRelocation,
  workerIds,
} from './mitigation-action.model';

function worker(o: Partial<AffectedWorker> = {}): AffectedWorker {
  // Los nombres son los de AffectedWorkerResource, verificados contra el backend
  // el 2026-11-13: toPositionId / toZoneId, NO los del turno (currentJobPositionId
  // / currentPlantZoneId). Este fixture los tuvo mal y por eso needsTarget pasaba
  // los tests estando roto: leia campos que nunca llegan y pedia destino siempre.
  return { workerId: 15, fromPositionId: 1, toPositionId: 3, toZoneId: 33, ...o };
}

function action(o: Partial<MitigationAction> = {}): MitigationAction {
  return {
    id: 1,
    type: 'ROTATION',
    state: 'PROPOSED',
    origin: 'ROTATION_SUGGESTED',
    priority: 'NORMAL',
    affectedWorkers: [worker()],
    history: [],
    createdAt: '2026-11-13T08:00:00',
    ...o,
  };
}

describe('isPending', () => {
  it('solo una medida PROPOSED se puede decidir', () => {
    expect(isPending(action())).toBe(true);
  });

  const cerrados: MitigationState[] = ['APPROVED', 'REJECTED', 'APPLIED', 'NOT_VIABLE', 'SUPERSEDED'];
  for (const state of cerrados) {
    it(`no se decide una medida en ${state}`, () => {
      expect(isPending(action({ state }))).toBe(false);
    });
  }
});

describe('needsTarget', () => {
  // Una excedencia dice que hay que mover al operario pero no a donde: ese dato
  // lo pone la persona al aprobar. Si el formulario no lo pide, el backend
  // rechaza la aprobacion por incompleta.
  it('una reprogramacion nunca pide destino: el operario no cambia de puesto', () => {
    expect(needsTarget(action({ type: 'RESCHEDULING', affectedWorkers: [worker({ toPositionId: null, toZoneId: null })] })))
      .toBe(false);
  });

  it('pide destino cuando falta el puesto', () => {
    expect(needsTarget(action({ affectedWorkers: [worker({ toPositionId: null })] }))).toBe(true);
  });

  it('pide destino cuando falta la zona', () => {
    expect(needsTarget(action({ affectedWorkers: [worker({ toZoneId: null })] }))).toBe(true);
  });

  it('pide destino cuando el campo viene ausente, no nulo', () => {
    const sinCampo = worker();
    delete (sinCampo as Partial<AffectedWorker>).toZoneId;
    expect(needsTarget(action({ affectedWorkers: [sinCampo] }))).toBe(true);
  });

  it('no lo pide cuando la sugerencia ya trae destino completo', () => {
    expect(needsTarget(action())).toBe(false);
  });

  it('no lo pide sobre una medida que ya no se puede decidir', () => {
    const cerrada = action({ state: 'APPLIED', affectedWorkers: [worker({ toZoneId: null })] });
    expect(needsTarget(cerrada)).toBe(false);
  });

  // La forma exacta que devuelve el backend en una reubicacion manual, copiada
  // de la respuesta real: con destino completo NO debe pedir nada. Es el caso
  // que el fixture equivocado volvia imposible de detectar.
  it('acepta la forma real de AffectedWorkerResource', () => {
    const real: AffectedWorker = {
      workerId: 16,
      fromPositionId: 1,
      toPositionId: 3,
      toZoneId: 33,
      doseAtDecision: {
        value: 0, unit: 'uT.h', methodId: 'PROVISIONAL-TWA-V1', limit: 800, percentage: 0,
      },
    };
    expect(needsTarget(action({ affectedWorkers: [real] }))).toBe(false);
  });
});

describe('workerIds', () => {
  it('una rotacion es un intercambio: dos operarios', () => {
    const rotacion = action({ affectedWorkers: [worker({ workerId: 15 }), worker({ workerId: 16 })] });
    expect(workerIds(rotacion)).toEqual([15, 16]);
  });

  it('no repite un operario que aparece en dos tramos', () => {
    const repetido = action({ affectedWorkers: [worker({ workerId: 15 }), worker({ workerId: 15 })] });
    expect(workerIds(repetido)).toEqual([15]);
  });
});

describe('stateLabelKey', () => {
  it('traduce el estado a su clave de i18n', () => {
    expect(stateLabelKey('PROPOSED')).toBe('mit_state_proposed');
    expect(stateLabelKey('NOT_VIABLE')).toBe('mit_state_not_viable');
  });
});

describe('validateRelocation', () => {
  it('con los tres ids es valida', () => {
    expect(validateRelocation({ workerId: 16, toZoneId: 32, toPositionId: 1 })).toBeNull();
  });

  it('exige operario, zona y puesto en ese orden', () => {
    expect(validateRelocation({})).toBe('relocation_worker_required');
    expect(validateRelocation({ workerId: 16 })).toBe('relocation_zone_required');
    expect(validateRelocation({ workerId: 16, toZoneId: 32 })).toBe('relocation_position_required');
  });

  // Un id a 0 es tan invalido como ausente: viene de un <select> sin elegir, que
  // es justo el caso que el formulario tiene que frenar.
  it('trata el cero como ausente', () => {
    expect(validateRelocation({ workerId: 0, toZoneId: 32, toPositionId: 1 }))
      .toBe('relocation_worker_required');
  });
});

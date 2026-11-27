import { explainAssessment } from './assessment-explanation';
import { Assessment } from './assessment.model';

const t = (key: string): string => ({
  af_expl_current: '{name} lleva {current} µT·s, el {pct} % de su límite ({limit} µT·s).',
  af_expl_exceeded: 'Superó el límite a las {time}.',
  af_expl_willExceed: 'Al ritmo actual lo superará a las {time}.',
  af_expl_noExceed: 'No llegará al límite.',
  af_expl_reschedule: 'Reprogramar.',
  af_expl_rescheduleNoCandidate: 'Reprogramar: no hay otro puesto en su zona.',
  af_expl_rotate: 'Rotarlo con {target}{position}.',
  af_expl_inPosition: ' en «{position}»',
  af_expl_anotherWorker: 'otro operario',
} as Record<string, string>)[key] ?? key;

function assessment(o: Partial<Assessment> = {}): Assessment {
  return {
    id: 'A', organizationId: 8, workerId: 18, sessionId: '632e692d-588d-4b33-b4df-f2923217c41c', status: 'RECOMMENDED',
    criticality: 'CRITICAL',
    projection: {
      currentIndex: 6540.023175, limitIndex: 3000, accumulationRate: 455, projectedIndexAtShiftEnd: 13102488,
      remainingMargin: -3540, consumedRatio: 2.18, projectedRatio: 4367, estimatedExceedanceAt: '2026-11-27T21:10:27Z',
      shiftEnd: '2026-11-28T05:10:12Z',
    },
    recommendation: { type: 'RESCHEDULE_TASK', sourceWorkerId: 18, sourcePositionId: 3,
      reason: 'Sin candidato viable en la zona: reprogramar la tarea del operario 18.' },
    ...o,
  } as Assessment;
}

describe('explainAssessment', () => {
  it('nombra al operario y su puesto, redondea con miles y usa la hora de Lima', () => {
    const text = explainAssessment(assessment(), { workerName: 'Fabricio Lopez', positionName: 'Prensa', t });
    expect(text).toContain('Fabricio Lopez (Prensa) lleva 6,540 µT·s, el 218 % de su límite (3,000 µT·s).');
    expect(text).toContain('Superó el límite a las');
    expect(text).not.toContain('UTC');
    expect(text).not.toContain('632e692d');
    expect(text).toContain('no hay otro puesto en su zona');
  });

  it('antes del limite dice cuando lo superara y propone la rotacion', () => {
    const text = explainAssessment(assessment({
      projection: { ...assessment().projection, consumedRatio: 0.85, currentIndex: 2550 },
      recommendation: { type: 'ROTATION', sourceWorkerId: 18, targetWorkerId: 19, targetPositionId: 4 },
    }), { workerName: 'Fabricio Lopez', targetWorkerName: 'Ana Ruiz', targetPositionName: 'Almacén', t });
    expect(text).toContain('Al ritmo actual lo superará a las');
    expect(text).toContain('Rotarlo con Ana Ruiz en «Almacén».');
  });
});

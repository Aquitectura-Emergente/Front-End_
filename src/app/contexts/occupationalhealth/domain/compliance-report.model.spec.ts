import {
  ComplianceReport,
  GenerateReportPayload,
  exportFileName,
  isAuditReady,
  traceabilityWarning,
  validateReportRequest,
} from './compliance-report.model';

function payload(o: Partial<GenerateReportPayload> = {}): GenerateReportPayload {
  return { scope: 'WORKER', workerId: 16, from: '2026-11-10', to: '2026-11-14', ...o };
}

function report(o: Partial<ComplianceReport> = {}): ComplianceReport {
  return {
    id: 1,
    scope: 'WORKER',
    subjectWorkerId: 16,
    periodFrom: '2026-11-10',
    periodTo: '2026-11-14',
    version: 1,
    digestAlgorithm: 'SHA-256',
    digestValue: 'abc123',
    evidenceVerified: true,
    fullyTraceable: true,
    entriesWithoutSource: 0,
    ...o,
  };
}

describe('validateReportRequest', () => {
  it('acepta una peticion correcta', () => {
    expect(validateReportRequest(payload())).toBeNull();
  });

  it('el ambito WORKER exige operario: sin el no hay sujeto', () => {
    expect(validateReportRequest(payload({ workerId: undefined }))).toBe('worker');
  });

  it('el ambito PLANT_ZONE no necesita operario', () => {
    expect(validateReportRequest(payload({ scope: 'PLANT_ZONE', workerId: undefined }))).toBeNull();
  });

  // Un periodo invertido devolveria un reporte vacio que parece correcto, y eso
  // es peor que un error: nadie se daria cuenta.
  it('rechaza un periodo invertido', () => {
    expect(validateReportRequest(payload({ from: '2026-11-14', to: '2026-11-10' }))).toBe('period');
  });

  it('acepta un periodo de un solo dia', () => {
    expect(validateReportRequest(payload({ from: '2026-11-10', to: '2026-11-10' }))).toBeNull();
  });

  it('rechaza un periodo incompleto', () => {
    expect(validateReportRequest(payload({ to: '' }))).toBe('period');
  });
});

describe('traceabilityWarning', () => {
  it('sin avisos, el reporte se puede auditar', () => {
    expect(traceabilityWarning(report())).toBeNull();
    expect(isAuditReady(report())).toBe(true);
  });

  it('avisa cuando no es trazable del todo', () => {
    expect(traceabilityWarning(report({ fullyTraceable: false }))).toBe('untraceable');
  });

  // Una entrada sin origen significa que ese tramo no se puede reconstruir, asi
  // que el reporte no vale aunque el backend diga que es trazable.
  it('avisa cuando hay entradas sin origen', () => {
    expect(traceabilityWarning(report({ entriesWithoutSource: 2 }))).toBe('untraceable');
  });

  it('avisa de la verificacion pendiente', () => {
    expect(traceabilityWarning(report({ evidenceVerified: false }))).toBe('unverified');
  });

  // La falta de trazas es mas grave que la verificacion pendiente: sin trazas no
  // se puede reconstruir el calculo, y es lo que hay que mostrar.
  it('la falta de trazas pesa mas que la verificacion', () => {
    const peor = report({ fullyTraceable: false, evidenceVerified: false });
    expect(traceabilityWarning(peor)).toBe('untraceable');
    expect(isAuditReady(peor)).toBe(false);
  });
});

describe('exportFileName', () => {
  it('nombra el archivo de un operario', () => {
    expect(exportFileName(report())).toBe('emsafe-worker-16-2026-11-10_2026-11-14-v1.pdf');
  });

  it('nombra el de una zona', () => {
    const zona = report({ scope: 'PLANT_ZONE', subjectWorkerId: null, version: 2 });
    expect(exportFileName(zona)).toBe('emsafe-plant-2026-11-10_2026-11-14-v2.pdf');
  });

  it('tolera un operario ausente en un reporte de operario', () => {
    const roto = report();
    delete (roto as Partial<ComplianceReport>).subjectWorkerId;
    expect(exportFileName(roto)).toContain('worker-NA');
  });
});

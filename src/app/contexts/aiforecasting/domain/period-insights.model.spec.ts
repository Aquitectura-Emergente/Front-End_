import {
  PeriodInsights,
  Recomendacion,
  affectedPositionLabel,
  byPriority,
  findingLabelKey,
  findingTone,
  insightsMatchPeriod,
  insightsSourceKey,
  priorityLabelKey,
  priorityPillClass,
} from './period-insights.model';

function rec(accion: string, prioridad: Recomendacion['prioridad']): Recomendacion {
  return { accion, motivo: '…', prioridad, operariosAfectados: [], puestosAfectados: [] };
}

describe('byPriority', () => {
  it('ordena ALTA, MEDIA, BAJA', () => {
    const list = [rec('capacitar', 'BAJA'), rec('reprogramar', 'ALTA'), rec('blindaje', 'MEDIA')];
    expect(byPriority(list).map(r => r.accion)).toEqual(['reprogramar', 'blindaje', 'capacitar']);
  });

  it('a igual prioridad conserva el orden del backend', () => {
    const list = [rec('a', 'MEDIA'), rec('b', 'ALTA'), rec('c', 'MEDIA'), rec('d', 'ALTA')];
    expect(byPriority(list).map(r => r.accion)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('no muta la lista original', () => {
    const list = [rec('a', 'BAJA'), rec('b', 'ALTA')];
    byPriority(list);
    expect(list.map(r => r.accion)).toEqual(['a', 'b']);
  });
});

describe('colores y etiquetas', () => {
  it('CRITICO rojo, ATENCION ambar, INFO neutro', () => {
    expect(findingTone('CRITICO')).toBe('danger');
    expect(findingTone('ATENCION')).toBe('warn');
    expect(findingTone('INFO')).toBe('neutral');
    expect(findingLabelKey('ATENCION')).toBe('ai_level_atencion');
  });

  it('la prioridad usa las pills del portal SSO', () => {
    expect(priorityPillClass('ALTA')).toBe('pill pill--danger');
    expect(priorityPillClass('MEDIA')).toBe('pill pill--warn');
    expect(priorityPillClass('BAJA')).toBe('pill pill--off');
    expect(priorityLabelKey('MEDIA')).toBe('ai_priority_media');
  });

  it('el origen distingue Gemini de las reglas automaticas', () => {
    expect(insightsSourceKey('LLM')).toBe('ai_source_llm');
    expect(insightsSourceKey('FALLBACK')).toBe('ai_source_fallback');
  });

  it('un puesto sin nombre se muestra por su id', () => {
    expect(affectedPositionLabel({ positionId: 1, positionName: 'Prensa hidráulica' })).toBe('Prensa hidráulica');
    expect(affectedPositionLabel({ positionId: 7 })).toBe('#7');
  });
});

describe('insightsMatchPeriod', () => {
  const insights = {
    period: { from: '2026-11-04', to: '2026-11-25', zone: 'America/Lima' },
  } as PeriodInsights;

  it('coincide con el periodo que se esta viendo', () => {
    expect(insightsMatchPeriod(insights, { from: '2026-11-04', to: '2026-11-25' })).toBe(true);
  });

  it('otro periodo, o ninguno, no coincide', () => {
    expect(insightsMatchPeriod(insights, { from: '2026-11-19', to: '2026-11-25' })).toBe(false);
    expect(insightsMatchPeriod(insights, null)).toBe(false);
  });
});

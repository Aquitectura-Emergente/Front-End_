import { Assessment } from './assessment.model';
import { limaTime } from './lima-time';

/** Lo que la vista conoce de la evaluación además de sus cifras. */
export interface ExplanationContext {
  workerName: string;
  positionName?: string | null;
  targetWorkerName?: string | null;
  targetPositionName?: string | null;
  t: (key: string) => string;
}

const NUMBER = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * Explicación legible de una evaluación, armada con sus datos estructurados.
 *
 * La que redacta el backend por plantilla está pensada para registro: lleva ids,
 * la criticidad en inglés, horas UTC y decimales sin redondear. Esta usa el
 * nombre del operario y del puesto, la hora de Lima y cifras redondeadas con
 * separador de miles. Cuando la redacta el LLM se muestra la suya.
 */
export function explainAssessment(a: Assessment, ctx: ExplanationContext): string {
  const p = a.projection;
  const who = ctx.positionName ? `${ctx.workerName} (${ctx.positionName})` : ctx.workerName;
  const parts = [
    fill(ctx.t('af_expl_current'), {
      name: who,
      current: NUMBER.format(p.currentIndex),
      pct: NUMBER.format(p.consumedRatio * 100),
      limit: NUMBER.format(p.limitIndex),
    }),
  ];

  if (p.estimatedExceedanceAt) {
    const key = p.consumedRatio >= 1 ? 'af_expl_exceeded' : 'af_expl_willExceed';
    parts.push(fill(ctx.t(key), { time: limaTime(p.estimatedExceedanceAt) }));
  } else {
    parts.push(ctx.t('af_expl_noExceed'));
  }

  const r = a.recommendation;
  if (r?.type === 'ROTATION') {
    const target = ctx.targetWorkerName ?? ctx.t('af_expl_anotherWorker');
    const position = ctx.targetPositionName ? fill(ctx.t('af_expl_inPosition'), { position: ctx.targetPositionName }) : '';
    parts.push(fill(ctx.t('af_expl_rotate'), { target, position }));
  } else if (r?.type === 'RESCHEDULE_TASK') {
    const noCandidate = /sin candidato|no viable|no candidate/i.test(r.reason ?? '');
    parts.push(ctx.t(noCandidate ? 'af_expl_rescheduleNoCandidate' : 'af_expl_reschedule'));
  }
  return parts.join(' ');
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '');
}

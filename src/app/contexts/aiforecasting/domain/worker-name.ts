/**
 * Nombres de operarios para las vistas de AI Forecasting.
 *
 * Las evaluaciones y la analítica solo traen `workerId`: el backend no manda
 * nombres a propósito (el prompt del LLM tampoco los lleva). El nombre se cruza
 * en el portal con los operarios que ya ve el SSO (`SsoFacade.workers()`).
 *
 * Se pide solo `{ id, name }` y no el `User` de IAM completo para no acoplar
 * este contexto al modelo de otro.
 */
export interface NamedWorker {
  id: number;
  name: string;
}

export type WorkerNames = ReadonlyMap<number, string>;

export function workerNameMap(workers: readonly NamedWorker[]): WorkerNames {
  const names = new Map<number, string>();
  for (const w of workers) {
    const name = w.name?.trim();
    if (name) names.set(w.id, name);
  }
  return names;
}

/**
 * Nombre del operario o, si no está en la lista del SSO (baja, otra
 * organización, fallo al cargarla), su id como `#14`. Nunca deja la celda vacía.
 */
export function workerName(workerId: number | null | undefined, names: WorkerNames): string {
  if (workerId == null) return '—';
  return names.get(workerId) ?? `#${workerId}`;
}

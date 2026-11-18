/**
 * Turno de un operario: dónde está trabajando y desde cuándo.
 *
 * Es lo que permite situar a la gente en el mapa de la planta. No hay
 * coordenadas: un operario «está» en una **zona**, y las zonas no tienen
 * latitud ni longitud. El mapa de planta es por zonas, no geográfico — a
 * diferencia del mapa de radiación del portal de admin.
 */
export interface WorkerShift {
  id: number;
  workerId: number;
  shiftDate: string;
  state: string;
  exposureSessionId?: string | null;
  currentJobPositionId?: number | null;
  currentPlantZoneId?: number | null;
  assignments: PositionAssignment[];
}

/** Tramo dentro del turno: cada rotación aprobada cierra uno y abre otro. */
export interface PositionAssignment {
  id: number;
  jobPositionId: number;
  plantZoneId: number;
  from: string;
  to?: string | null;
  sourceActionId?: number | null;
  durationMinutes: number;
}

/**
 * Un operario situado en el mapa.
 *
 * `shift` va nulo cuando no tiene turno abierto: el backend responde **404**,
 * no una lista vacía, así que la pantalla tiene que tratar la ausencia como un
 * caso normal y no como un error.
 */
export interface WorkerPlacement {
  workerId: number;
  name: string;
  initials: string;
  shift: WorkerShift | null;
}

/** Operarios agrupados por la zona en la que están ahora. */
export interface ZoneOccupancy {
  plantZoneId: number;
  zoneName: string;
  workers: WorkerPlacement[];
}

/**
 * Reparte a los operarios por zona.
 *
 * Devuelve **todas** las zonas, incluso las vacías: una zona sin nadie es
 * información útil para el responsable, no un hueco que esconder. Los que no
 * tienen turno abierto salen aparte, en `unassigned`.
 */
export function groupByZone(
  placements: readonly WorkerPlacement[],
  zones: readonly { id: number; name: string }[],
): { occupancy: ZoneOccupancy[]; unassigned: WorkerPlacement[] } {
  const occupancy: ZoneOccupancy[] = zones.map(z => ({
    plantZoneId: z.id,
    zoneName: z.name,
    workers: [],
  }));
  const byId = new Map(occupancy.map(o => [o.plantZoneId, o]));
  const unassigned: WorkerPlacement[] = [];

  for (const placement of placements) {
    const zoneId = placement.shift?.currentPlantZoneId;
    const bucket = zoneId != null ? byId.get(zoneId) : undefined;
    if (bucket) bucket.workers.push(placement);
    else unassigned.push(placement);
  }

  return { occupancy, unassigned };
}

/** Un operario con turno abierto está en planta. */
export function isOnShift(placement: WorkerPlacement): boolean {
  return placement.shift?.currentPlantZoneId != null;
}

/**
 * Apertura de turno (`POST /workers/{id}/shifts`).
 *
 * `exposureSessionId` es opcional y **es el cable con dosimetría**: si se
 * informa, el turno queda atado a la sesión de exposición que mide a ese
 * operario. Se deja fuera cuando el dosímetro todavía no ha abierto sesión —el
 * turno se abre igual y la sesión llega después—, que es el caso normal al
 * empezar la jornada.
 */
export interface StartShiftPayload {
  jobPositionId: number;
  plantZoneId: number;
  exposureSessionId?: string;
}

/**
 * Un turno solo se puede abrir si el operario no tiene otro abierto.
 *
 * El backend lo rechaza —un operario no puede estar en dos sitios— y sin esta
 * comprobación la pantalla ofrecería un botón que iba a devolver un error. La
 * contraria también vale: solo se cierra lo que está abierto.
 */
export function canStartShift(placement: WorkerPlacement): boolean {
  return !isOnShift(placement);
}

export function canCloseShift(placement: WorkerPlacement): boolean {
  return isOnShift(placement);
}

/**
 * Puestos elegibles para abrir un turno en una zona.
 *
 * Un puesto pertenece a una sola zona, así que elegir zona acota el puesto. Es
 * la misma regla que ya aplica el formulario de aprobación de una medida, y se
 * centraliza aquí para no tenerla dos veces en dos pantallas.
 */
export function positionsOfZone<T extends { plantZoneId: number }>(
  positions: readonly T[],
  plantZoneId: number | null,
): T[] {
  return plantZoneId ? positions.filter(p => p.plantZoneId === plantZoneId) : [];
}

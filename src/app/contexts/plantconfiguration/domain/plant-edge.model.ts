import { PlantEdgeStatus } from './plant-zone.model';

/**
 * Nodo edge de planta: el gateway que recibe por BLE las lecturas de los
 * dosímetros y las publica hacia la nube.
 *
 * El portal solo **declara** el nodo: el hardware lo instala el técnico y el
 * software vive en el repo `emsafe-edge-industrial`. Aquí se registra su serial
 * para poder atribuir cada lectura a una zona.
 */
export interface PlantEdge {
  id: number;
  plantZoneId: number;
  plantZoneName: string;
  serialNumber: string;
  status: PlantEdgeStatus;
  createdAt: string;
}

export interface PlantEdgePayload {
  plantZoneId: number;
  serialNumber: string;
}

export type { PlantEdgeStatus } from './plant-zone.model';

/**
 * Una zona admite **un solo** edge.
 *
 * Lo garantiza una restricción única en la tabla (`uq_plant_edges_zone`), y el
 * backend responde 400 al intentar declarar el segundo. Esta función permite
 * filtrar el desplegable de zonas al declarar, para que la opción inválida no
 * se pueda ni elegir.
 */
export function zonesWithoutEdge<T extends { id: number }>(
  zones: readonly T[],
  edges: readonly PlantEdge[],
): T[] {
  const taken = new Set(edges.map(e => e.plantZoneId));
  return zones.filter(z => !taken.has(z.id));
}

/** Un edge activo se puede desactivar, y al contrario. Nunca las dos a la vez. */
export function canActivate(edge: PlantEdge): boolean {
  return edge.status === 'INACTIVE';
}

export function canDeactivate(edge: PlantEdge): boolean {
  return edge.status === 'ACTIVE';
}

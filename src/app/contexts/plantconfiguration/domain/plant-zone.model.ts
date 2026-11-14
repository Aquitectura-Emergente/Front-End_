/**
 * Zona de planta: la unidad geográfica del segmento industrial.
 *
 * El catálogo lo declara el responsable de SSO desde este portal, y es el
 * prerrequisito del resto: los puestos de trabajo cuelgan de una zona, los
 * límites de exposición se configuran por puesto, y las lecturas se atribuyen a
 * la zona del edge que las recibe.
 *
 * No confundir con `location` de un dispositivo, que es texto libre heredado del
 * segmento hogar: `plantZoneId` es la identidad canónica y convive con él.
 */
/**
 * Los campos opcionales **se omiten**, no llegan como `null`: el backend tiene
 * `spring.jackson.default-property-inclusion=non_null`. Por eso van declarados
 * con `?` y hay que comprobarlos por verdad (`!zone.edgeSerialNumber`) y nunca
 * con `=== null`, que daría `false` para un campo ausente.
 */
export interface PlantZone {
  id: number;
  organizationId: number;
  name: string;
  description?: string | null;
  createdAt: string;
  /** Serial del edge que sirve la zona. Ausente si todavía no se ha declarado. */
  edgeSerialNumber?: string | null;
  edgeStatus?: PlantEdgeStatus | null;
  deviceCount: number;
  jobPositionCount: number;
}

export type PlantEdgeStatus = 'ACTIVE' | 'INACTIVE';

export interface PlantZonePayload {
  name: string;
  description?: string;
}

/** Motivo por el que una zona no se puede borrar, o null si sí se puede. */
export type ZoneDeletionBlocker = 'edge' | 'positions' | 'devices' | null;

/**
 * Por qué una zona no se puede borrar.
 *
 * Replica las tres comprobaciones que hace `PlantZoneService.delete` en el
 * backend, que es quien manda. Aquí sirven para **no ofrecer una acción que iba
 * a fallar** y poder explicar el motivo en la propia tabla, en vez de dejar que
 * el usuario descubra el 400 al pulsar.
 *
 * Se puede decidir en el cliente porque el DTO ya trae las tres señales
 * (`edgeSerialNumber`, `jobPositionCount`, `deviceCount`): no hace falta una
 * llamada extra.
 *
 * El orden importa y es el mismo que el del backend: si una zona tiene edge y
 * además puestos, el mensaje que verá el usuario tras intentar borrar será el
 * del edge, así que es el que hay que mostrar.
 */
export function zoneDeletionBlocker(zone: PlantZone): ZoneDeletionBlocker {
  if (zone.edgeSerialNumber) return 'edge';
  if (zone.jobPositionCount > 0) return 'positions';
  if (zone.deviceCount > 0) return 'devices';
  return null;
}

/** Atajo para la vista: una zona vacía y sin edge se puede borrar. */
export function canDeleteZone(zone: PlantZone): boolean {
  return zoneDeletionBlocker(zone) === null;
}

/**
 * Una zona sin edge declarado no recibe telemetría.
 *
 * Es el aviso que más importa de la pantalla: la zona existe, los puestos están
 * configurados, y aun así no llega ninguna lectura porque falta el nodo. Sin
 * esto, el síntoma es un mapa vacío sin explicación.
 *
 * Se comprueba por verdad y no con `=== null` porque el backend **omite** el
 * campo cuando no hay edge, así que llega `undefined`. Verificado contra la API
 * real: una comparación con `null` devolvía `false` y la zona no se marcaba.
 */
export function isAwaitingEdge(zone: PlantZone): boolean {
  return !zone.edgeSerialNumber;
}

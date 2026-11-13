/**
 * Puesto de trabajo dentro de una zona de planta.
 *
 * Importa más de lo que parece: el límite de exposición ocupacional se
 * configura **por puesto** (RF18), así que un operario sin puesto no tiene
 * límite aplicable y su jornada no se puede evaluar.
 */
/** `description` va con `?`: el backend omite los campos nulos (`non_null`). */
export interface JobPosition {
  id: number;
  plantZoneId: number;
  /** Desnormalizado por el backend para listar sin una segunda llamada. */
  plantZoneName: string;
  name: string;
  description?: string | null;
  createdAt: string;
}

export interface JobPositionPayload {
  plantZoneId: number;
  name: string;
  description?: string;
}

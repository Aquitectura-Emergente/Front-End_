import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { JobPositionApi } from '../infrastructure/job-position-api';
import { PlantEdgeApi } from '../infrastructure/plant-edge-api';
import { PlantZoneApi } from '../infrastructure/plant-zone-api';
import { JobPosition, JobPositionPayload } from '../domain/job-position.model';
import {
  PlantEdge,
  PlantEdgePayload,
  canActivate,
  canDeactivate,
  zonesWithoutEdge,
} from '../domain/plant-edge.model';
import {
  PlantZone,
  PlantZonePayload,
  ZoneDeletionBlocker,
  canDeleteZone,
  isAwaitingEdge,
  zoneDeletionBlocker,
} from '../domain/plant-zone.model';

/** Lo que la pantalla necesita de una sola vez para pintarse. */
export interface PlantConfigSnapshot {
  zones: PlantZone[];
  positions: JobPosition[];
  edges: PlantEdge[];
}

/**
 * Punto de entrada del contexto plantconfiguration para la presentación.
 *
 * Una sola fachada para los tres agregados —y no una por cada uno— porque la
 * pantalla los muestra juntos y las reglas los cruzan: declarar un edge necesita
 * saber qué zonas están libres, y borrar una zona depende de sus puestos y
 * dispositivos. Separarlas obligaría a la vista a coordinarlas, que es justo lo
 * que la fachada existe para evitar.
 */
@Injectable({ providedIn: 'root' })
export class PlantConfigFacade {
  private zoneApi = inject(PlantZoneApi);
  private positionApi = inject(JobPositionApi);
  private edgeApi = inject(PlantEdgeApi);

  /** Las tres listas en paralelo. Cada una degrada a vacío si su llamada falla. */
  snapshot(): Observable<PlantConfigSnapshot> {
    return forkJoin({
      zones: this.zoneApi.list(),
      positions: this.positionApi.list(),
      edges: this.edgeApi.list(),
    });
  }

  // ── Zonas ────────────────────────────────────────────────────────────────

  zones(): Observable<PlantZone[]> {
    return this.zoneApi.list();
  }

  createZone(payload: PlantZonePayload): Observable<PlantZone | null> {
    return this.zoneApi.create(payload);
  }

  updateZone(id: number, payload: PlantZonePayload): Observable<PlantZone | null> {
    return this.zoneApi.update(id, payload);
  }

  removeZone(id: number): Observable<void> {
    return this.zoneApi.remove(id);
  }

  // ── Puestos de trabajo ───────────────────────────────────────────────────

  positions(plantZoneId?: number): Observable<JobPosition[]> {
    return this.positionApi.list(plantZoneId);
  }

  createPosition(payload: JobPositionPayload): Observable<JobPosition | null> {
    return this.positionApi.create(payload);
  }

  updatePosition(id: number, payload: JobPositionPayload): Observable<JobPosition | null> {
    return this.positionApi.update(id, payload);
  }

  removePosition(id: number): Observable<void> {
    return this.positionApi.remove(id);
  }

  // ── Nodos edge ───────────────────────────────────────────────────────────

  edges(): Observable<PlantEdge[]> {
    return this.edgeApi.list();
  }

  declareEdge(payload: PlantEdgePayload): Observable<PlantEdge | null> {
    return this.edgeApi.declare(payload);
  }

  updateEdgeSerial(id: number, serialNumber: string): Observable<PlantEdge | null> {
    return this.edgeApi.updateSerial(id, serialNumber);
  }

  activateEdge(id: number): Observable<PlantEdge | null> {
    return this.edgeApi.activate(id);
  }

  deactivateEdge(id: number): Observable<PlantEdge | null> {
    return this.edgeApi.deactivate(id);
  }

  removeEdge(id: number): Observable<void> {
    return this.edgeApi.remove(id);
  }

  // ── Reglas de dominio que consulta la vista ──────────────────────────────

  /** Por qué no se puede borrar una zona, o null si sí se puede. */
  zoneDeletionBlocker(zone: PlantZone): ZoneDeletionBlocker {
    return zoneDeletionBlocker(zone);
  }

  canDeleteZone(zone: PlantZone): boolean {
    return canDeleteZone(zone);
  }

  /** Zona configurada que todavía no recibe telemetría porque le falta el nodo. */
  isAwaitingEdge(zone: PlantZone): boolean {
    return isAwaitingEdge(zone);
  }

  /** Zonas que admiten un edge nuevo: una zona solo puede tener uno. */
  zonesWithoutEdge(zones: readonly PlantZone[], edges: readonly PlantEdge[]): PlantZone[] {
    return zonesWithoutEdge(zones, edges);
  }

  canActivateEdge(edge: PlantEdge): boolean {
    return canActivate(edge);
  }

  canDeactivateEdge(edge: PlantEdge): boolean {
    return canDeactivate(edge);
  }
}

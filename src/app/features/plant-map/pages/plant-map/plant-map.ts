import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import {
  WorkerPlacement,
  ZoneOccupancy,
} from '../../../../contexts/occupationalhealth/domain/worker-shift.model';
import { PlantZone } from '../../../../contexts/plantconfiguration/domain/plant-zone.model';
import { JobPosition } from '../../../../contexts/plantconfiguration/domain/job-position.model';
import { LanguageService } from '../../../../core/services/language.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { SessionControlFacade } from '../../../../contexts/personaldosimetry/application/session-control-facade';
import { StartSessionDialog } from '../../../risk-workers/components/start-session-dialog/start-session-dialog';
import { map } from 'rxjs/operators';
import { DateTimePipe } from '../../../../core/pipes/datetime.pipe';

/**
 * Mapa de la planta: qué operarios hay ahora en cada zona.
 *
 * **No es un mapa geográfico**, y esa es la diferencia con el de radiación del
 * portal de admin. Las zonas de planta no tienen coordenadas en la base de
 * datos: un operario «está» en una zona, no en un punto. Así que el mapa es una
 * disposición por zonas, que además es como se razona en una planta.
 *
 * Se pinta cruzando dos cosas: las zonas del catálogo y el turno abierto de cada
 * operario. El turno lo abre la jornada: desde aquí el SSO inicia o cierra la
 * jornada, nunca el turno por separado. Un operario sin turno no es un error
 * — el backend responde 404 — y sale aparte como «fuera de planta».
 */
@Component({
  selector: 'app-plant-map',
  imports: [TranslatePipe, FormsModule, RouterLink, StartSessionDialog, DateTimePipe],
  templateUrl: './plant-map.html',
  styleUrl: './plant-map.scss',
})
export class PlantMap implements OnInit {
  private mitigation = inject(MitigationFacade);
  private plant = inject(PlantConfigFacade);
  private toast = inject(ToastService);
  private activity = inject(ActivityService);
  private confirmService = inject(ConfirmService);
  private control = inject(SessionControlFacade);
  protected lang = inject(LanguageService);

  loading = signal(true);
  zones = signal<PlantZone[]>([]);
  positions = signal<JobPosition[]>([]);
  placements = signal<WorkerPlacement[]>([]);

  private grouped = computed(() =>
    this.mitigation.groupByZone(
      this.placements(),
      this.zones().map(z => ({ id: z.id, name: z.name })),
    )
  );

  occupancy = computed<ZoneOccupancy[]>(() => this.grouped().occupancy);
  unassigned = computed<WorkerPlacement[]>(() => this.grouped().unassigned);

  onShiftCount = computed(() => this.occupancy().reduce((n, z) => n + z.workers.length, 0));
  totalWorkers = computed(() => this.placements().length);

  ngOnInit(): void {
    this.reload();
  }

  /**
   * Carga el catálogo y, encima, dónde está cada operario.
   *
   * Los puestos hacen falta además de las zonas porque abrir un turno los pide,
   * y vienen juntos en `snapshot()` para no hacer dos viajes.
   */
  reload(): void {
    this.loading.set(true);
    this.plant.snapshot().subscribe(({ zones, positions }) => {
      this.zones.set(zones);
      this.positions.set(positions);
      this.mitigation.placements().subscribe(placements => {
        this.placements.set(placements);
        this.loading.set(false);
      });
    });
  }

  /** Zona sin nadie: puede significar que un turno no se cubrió. */
  isEmptyZone(zone: ZoneOccupancy): boolean {
    return zone.workers.length === 0;
  }

  /** Una zona sin nodo edge no recibe telemetría, aunque tenga gente dentro. */
  isAwaitingEdge(plantZoneId: number): boolean {
    const zone = this.zones().find(z => z.id === plantZoneId);
    return zone ? this.plant.isAwaitingEdge(zone) : false;
  }

  /** Puesto del operario dentro de la zona, para distinguir quién hace qué. */
  /** Nombre del puesto actual (el id solo si el puesto ya no está en el catálogo). */
  positionOf(placement: WorkerPlacement): string | null {
    const id = placement.shift?.currentJobPositionId;
    if (id == null) return null;
    return this.positions().find(p => p.id === id)?.name ?? `#${id}`;
  }

  /** Desde cuándo está en planta: inicio del primer tramo de su turno. */
  sinceOf(placement: WorkerPlacement): string | null {
    const from = placement.shift?.assignments?.map(a => a.from).sort()[0];
    return from ?? null;
  }

  // ── Secciones de planta ──────────────────────────────────────────────────

  /**
   * Alta de una sección (zona) desde el propio mapa.
   *
   * La pantalla de configuración ya lo permite, pero es **aquí** donde se ve que
   * falta una sección, y mandar al usuario a otra pantalla rompía ese momento.
   * No es una segunda forma de crear zonas: comparte la misma fachada y el mismo
   * `POST /v1/plant-config/zones`, así que las reglas no se duplican.
   *
   * Solo crea. Editar y borrar siguen viviendo en configuración de planta,
   * porque borrar depende de puestos, dispositivos y edge — tres comprobaciones
   * que esta pantalla no tiene a mano.
   */
  showZoneForm = signal(false);
  zoneName = signal('');
  zoneDescription = signal('');
  savingZone = signal(false);

  openZoneForm(): void {
    this.zoneName.set('');
    this.zoneDescription.set('');
    this.showZoneForm.set(true);
  }

  closeZoneForm(): void {
    this.showZoneForm.set(false);
  }

  /** El nombre es obligatorio; la descripción, opcional. */
  canSaveZone(): boolean {
    return this.zoneName().trim().length > 0;
  }

  saveZone(): void {
    const name = this.zoneName().trim();
    if (!name) {
      this.toast.error(this.lang.t('plant_zones_name'));
      return;
    }
    this.savingZone.set(true);
    this.plant.createZone({
      name,
      description: this.zoneDescription().trim() || undefined,
    }).subscribe(saved => {
      this.savingZone.set(false);
      if (!saved) {
        this.toast.error(this.lang.t('plant_failed'));
        return;
      }
      this.activity.log('Plant zone created', name);
      this.toast.success(this.lang.t('plant_saved'));
      this.closeZoneForm();
      // Recarga completa: la zona nueva entra vacía y sin edge, y el aviso de
      // «zona sin edge» depende del catálogo, no solo de la lista de zonas.
      this.reload();
    });
  }

  // ── Turnos ───────────────────────────────────────────────────────────────

  /**
   * Operario cuya petición está en vuelo, para no dejar pulsar dos veces.
   *
   * Es el id y no un booleano porque hay un botón por persona: con un
   * booleano se bloquearían todos a la vez.
   */
  busy = signal<number | null>(null);

  /** Operario al que se le está iniciando la jornada (diálogo abierto). */
  startFor = signal<WorkerPlacement | null>(null);

  canCloseShift(placement: WorkerPlacement): boolean {
    return this.mitigation.canCloseShift(placement);
  }

  /**
   * Iniciar jornada: el mismo diálogo de «Operarios en riesgo», con el operario
   * ya elegido. Al iniciarla, el backend abre su turno en la zona del puesto.
   */
  openStart(placement: WorkerPlacement): void {
    this.startFor.set(placement);
  }

  closeStart(): void {
    this.startFor.set(null);
  }

  onStarted(): void {
    const placement = this.startFor();
    this.activity.log('Exposure shift started', `#${placement?.workerId}`);
    this.closeStart();
    if (placement) this.awaitShift(placement.workerId);
  }

  /**
   * El turno lo abre el backend justo después de confirmar la jornada, así que
   * puede tardar un instante: se vuelve a consultar hasta verlo (máx. ~6 s).
   */
  private awaitShift(workerId: number, attempt = 0): void {
    setTimeout(() => {
      this.mitigation.placements().subscribe(placements => {
        this.placements.set(placements);
        const onShift = placements.some(p => p.workerId === workerId && !!p.shift);
        if (!onShift && attempt < 8) this.awaitShift(workerId, attempt + 1);
      });
    }, 700);
  }

  /**
   * Cierra la jornada del operario y, con ella, su turno: sale del mapa en el
   * acto. Un turno sin jornada vinculada (abierto a mano antes) solo se cierra.
   *
   * Pide confirmación porque no se puede deshacer: se inicia otra jornada.
   */
  closeShift(placement: WorkerPlacement): void {
    if (!this.confirmService.confirm(this.lang.t('map_closeSessionConfirm'))) return;
    this.busy.set(placement.workerId);
    const sessionId = placement.shift?.exposureSessionId;
    const request = sessionId
      ? this.control.close(sessionId).pipe(map(result => result.ok))
      : this.mitigation.closeShift(placement.workerId);
    request.subscribe(done => {
      this.busy.set(null);
      if (!done) {
        this.toast.error(this.lang.t('map_closeSessionFailed'));
        return;
      }
      this.activity.log('Exposure shift closed', `#${placement.workerId}`);
      this.toast.success(this.lang.t('sc_closed'));
      this.reload();
    });
  }
}

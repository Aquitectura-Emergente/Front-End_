import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { JobPosition } from '../../../../contexts/plantconfiguration/domain/job-position.model';
import { PlantEdge } from '../../../../contexts/plantconfiguration/domain/plant-edge.model';
import { PlantZone } from '../../../../contexts/plantconfiguration/domain/plant-zone.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';

type Tab = 'zones' | 'positions' | 'edges';

/**
 * Configuración de planta: zonas, puestos y nodos edge.
 *
 * Es el catálogo que el responsable de SSO declara, y el prerrequisito del resto
 * del segmento industrial: los límites de exposición se configuran por puesto y
 * las lecturas se atribuyen a la zona del edge que las recibe.
 *
 * Las tres pestañas comparten pantalla porque las reglas las cruzan: un puesto
 * necesita una zona, y declarar un edge solo tiene sentido en una zona que
 * todavía no tenga uno.
 */
@Component({
  selector: 'app-plant-config',
  imports: [TranslatePipe, FormsModule],
  templateUrl: './plant-config.html',
  styleUrl: './plant-config.scss',
})
export class PlantConfig implements OnInit {
  private facade = inject(PlantConfigFacade);
  private toast = inject(ToastService);
  private confirmService = inject(ConfirmService);
  private activity = inject(ActivityService);
  protected lang = inject(LanguageService);

  loading = signal(true);
  tab = signal<Tab>('zones');

  zones = signal<PlantZone[]>([]);
  positions = signal<JobPosition[]>([]);
  edges = signal<PlantEdge[]>([]);

  /** Zonas que todavía admiten un edge: una zona solo puede tener uno. */
  availableZones = computed(() => this.facade.zonesWithoutEdge(this.zones(), this.edges()));

  /** Zonas configuradas que no reciben telemetría por faltarles el nodo. */
  awaitingEdgeCount = computed(() => this.zones().filter(z => this.facade.isAwaitingEdge(z)).length);

  // ── Formularios ──────────────────────────────────────────────────────────
  // Campos planos y no un FormGroup, igual que el resto de pantallas del portal.

  showZoneForm = signal(false);
  editingZoneId = signal<number | null>(null);
  zoneName = '';
  zoneDescription = '';

  showPositionForm = signal(false);
  editingPositionId = signal<number | null>(null);
  positionName = '';
  positionDescription = '';
  positionZoneId = '';

  showEdgeForm = signal(false);
  edgeSerial = '';
  edgeZoneId = '';

  ngOnInit(): void {
    this.reload();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
  }

  private reload(): void {
    this.loading.set(true);
    this.facade.snapshot().subscribe(({ zones, positions, edges }) => {
      this.zones.set(zones);
      this.positions.set(positions);
      this.edges.set(edges);
      this.loading.set(false);
    });
  }

  // ── Zonas ────────────────────────────────────────────────────────────────

  openZoneForm(zone?: PlantZone): void {
    this.editingZoneId.set(zone?.id ?? null);
    this.zoneName = zone?.name ?? '';
    this.zoneDescription = zone?.description ?? '';
    this.showZoneForm.set(true);
  }

  closeZoneForm(): void {
    this.showZoneForm.set(false);
  }

  saveZone(): void {
    const name = this.zoneName.trim();
    if (!name) {
      this.toast.error(this.lang.t('plant_zones_name'));
      return;
    }
    const payload = { name, description: this.zoneDescription.trim() || undefined };
    const id = this.editingZoneId();
    const call = id === null
      ? this.facade.createZone(payload)
      : this.facade.updateZone(id, payload);

    call.subscribe(saved => {
      if (!saved) {
        this.toast.error(this.lang.t('plant_failed'));
        return;
      }
      this.activity.log(id === null ? 'Plant zone created' : 'Plant zone updated', name);
      this.toast.success(this.lang.t('plant_saved'));
      this.closeZoneForm();
      this.reload();
    });
  }

  /**
   * El botón de borrar solo aparece si la regla lo permite, pero se vuelve a
   * preguntar aquí: la lista puede haber cambiado en otra pestaña del navegador.
   */
  canDeleteZone(zone: PlantZone): boolean {
    return this.facade.canDeleteZone(zone);
  }

  /** Clave de traducción del motivo por el que una zona no se puede borrar. */
  zoneBlockerKey(zone: PlantZone): string | null {
    switch (this.facade.zoneDeletionBlocker(zone)) {
      case 'edge': return 'plant_zones_blockedByEdge';
      case 'positions': return 'plant_zones_blockedByPositions';
      case 'devices': return 'plant_zones_blockedByDevices';
      default: return null;
    }
  }

  isAwaitingEdge(zone: PlantZone): boolean {
    return this.facade.isAwaitingEdge(zone);
  }

  deleteZone(zone: PlantZone): void {
    if (!this.confirmService.confirm(this.lang.t('plant_confirm_deleteZone'))) return;
    this.facade.removeZone(zone.id).subscribe(() => {
      this.activity.log('Plant zone deleted', zone.name);
      this.toast.success(this.lang.t('plant_deleted'));
      this.reload();
    });
  }

  // ── Puestos de trabajo ───────────────────────────────────────────────────

  openPositionForm(position?: JobPosition): void {
    this.editingPositionId.set(position?.id ?? null);
    this.positionName = position?.name ?? '';
    this.positionDescription = position?.description ?? '';
    this.positionZoneId = String(position?.plantZoneId ?? this.zones()[0]?.id ?? '');
    this.showPositionForm.set(true);
  }

  closePositionForm(): void {
    this.showPositionForm.set(false);
  }

  savePosition(): void {
    const name = this.positionName.trim();
    const zoneId = Number(this.positionZoneId);
    if (!name || !zoneId) {
      this.toast.error(this.lang.t('plant_failed'));
      return;
    }
    const payload = {
      plantZoneId: zoneId,
      name,
      description: this.positionDescription.trim() || undefined,
    };
    const id = this.editingPositionId();
    const call = id === null
      ? this.facade.createPosition(payload)
      : this.facade.updatePosition(id, payload);

    call.subscribe(saved => {
      if (!saved) {
        this.toast.error(this.lang.t('plant_failed'));
        return;
      }
      this.activity.log(id === null ? 'Job position created' : 'Job position updated', name);
      this.toast.success(this.lang.t('plant_saved'));
      this.closePositionForm();
      this.reload();
    });
  }

  deletePosition(position: JobPosition): void {
    if (!this.confirmService.confirm(this.lang.t('plant_confirm_deletePosition'))) return;
    this.facade.removePosition(position.id).subscribe(() => {
      this.activity.log('Job position deleted', position.name);
      this.toast.success(this.lang.t('plant_deleted'));
      this.reload();
    });
  }

  // ── Nodos edge ───────────────────────────────────────────────────────────

  openEdgeForm(): void {
    this.edgeSerial = '';
    this.edgeZoneId = String(this.availableZones()[0]?.id ?? '');
    this.showEdgeForm.set(true);
  }

  closeEdgeForm(): void {
    this.showEdgeForm.set(false);
  }

  declareEdge(): void {
    const serial = this.edgeSerial.trim();
    const zoneId = Number(this.edgeZoneId);
    if (!serial || !zoneId) {
      this.toast.error(this.lang.t('plant_failed'));
      return;
    }
    this.facade.declareEdge({ plantZoneId: zoneId, serialNumber: serial }).subscribe(saved => {
      if (!saved) {
        this.toast.error(this.lang.t('plant_failed'));
        return;
      }
      this.activity.log('Edge node declared', serial);
      this.toast.success(this.lang.t('plant_saved'));
      this.closeEdgeForm();
      this.reload();
    });
  }

  canActivateEdge(edge: PlantEdge): boolean {
    return this.facade.canActivateEdge(edge);
  }

  canDeactivateEdge(edge: PlantEdge): boolean {
    return this.facade.canDeactivateEdge(edge);
  }

  activateEdge(edge: PlantEdge): void {
    this.facade.activateEdge(edge.id).subscribe(updated => {
      if (!updated) {
        this.toast.error(this.lang.t('plant_failed'));
        return;
      }
      this.activity.log('Edge node activated', edge.serialNumber);
      this.reload();
    });
  }

  deactivateEdge(edge: PlantEdge): void {
    this.facade.deactivateEdge(edge.id).subscribe(updated => {
      if (!updated) {
        this.toast.error(this.lang.t('plant_failed'));
        return;
      }
      this.activity.log('Edge node deactivated', edge.serialNumber);
      this.reload();
    });
  }

  deleteEdge(edge: PlantEdge): void {
    if (!this.confirmService.confirm(this.lang.t('plant_confirm_deleteEdge'))) return;
    this.facade.removeEdge(edge.id).subscribe(() => {
      this.activity.log('Edge node deleted', edge.serialNumber);
      this.toast.success(this.lang.t('plant_deleted'));
      this.reload();
    });
  }
}

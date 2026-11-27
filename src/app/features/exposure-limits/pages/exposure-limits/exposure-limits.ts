import { UnitPipe } from '../../../../core/pipes/unit.pipe';
import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { DateTimePipe } from '../../../../core/pipes/datetime.pipe';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { DosimetryFacade } from '../../../../contexts/personaldosimetry/application/dosimetry-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { ExposureLimit, LIMIT_REFERENCES, limitReference, localDateTimeInput } from '../../../../contexts/personaldosimetry/domain/exposure-limit.model';
import { JobPosition } from '../../../../contexts/plantconfiguration/domain/job-position.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';
import { describeError } from '../../../../core/http/backend-error';

/**
 * Límites de exposición ocupacional, uno por puesto de trabajo (RF18).
 *
 * Tres cosas de esta pantalla no son obvias:
 *
 *  1. **Se añade, no se edita.** Configurar otra vez el mismo puesto crea una
 *     versión nueva con su propia vigencia; las jornadas ya cerradas siguen
 *     evaluadas con la que estaba en vigor. Lo exige el RNF18 y por eso la
 *     tabla muestra la vigente y guarda el resto como historial.
 *  2. **El umbral de advertencia es una proporción**, entre 0 y 1 sin incluir
 *     los extremos. Con 1 avisaría en el instante en que ya se ha superado el
 *     límite; con 0 avisaría siempre.
 *  3. **Dosimetría tiene permisos propios.** Si el responsable no tiene el
 *     *membership* de dosimetría, el backend responde 403 aunque su rol sea
 *     correcto. La pantalla lo explica en vez de quedarse en blanco.
 */
@Component({
  selector: 'app-exposure-limits',
  imports: [UnitPipe, TranslatePipe, FormsModule, DecimalPipe, DateTimePipe],
  templateUrl: './exposure-limits.html',
  styleUrl: './exposure-limits.scss',
})
export class ExposureLimits implements OnInit {
  private dosimetry = inject(DosimetryFacade);
  private plant = inject(PlantConfigFacade);
  private sso = inject(SsoFacade);
  private toast = inject(ToastService);
  private activity = inject(ActivityService);
  protected lang = inject(LanguageService);

  loading = signal(true);
  limits = signal<ExposureLimit[]>([]);
  positions = signal<JobPosition[]>([]);
  /** Null hasta que se sabe; distinto de «no hay límites configurados». */
  unavailable = signal(false);

  current = computed(() => this.dosimetry.currentByPosition(this.limits()));

  /** Puestos todavía sin límite: son los que no se pueden evaluar. */
  withoutLimit = computed(() => {
    const configured = new Set(this.current().map(l => l.jobPositionId));
    return this.positions().filter(p => !configured.has(p.id));
  });

  // ── Formulario ───────────────────────────────────────────────────────────

  showForm = signal(false);
  formPositionId = '';
  formLimitIndex = '';
  formWarningRatio = '0.8';
  formEffectiveFrom = '';
  /** '' = sin referencia, 'other' = escrita a mano; si no, una de la lista. */
  formReferenceChoice = '';
  formReferenceOther = '';
  readonly references = LIMIT_REFERENCES;

  ngOnInit(): void {
    this.plant.positions().subscribe(positions => this.positions.set(positions));
    this.reload();
  }

  private reload(): void {
    const org = this.sso.organizationId();
    if (org === null) {
      this.unavailable.set(true);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.dosimetry.limits(org).subscribe(limits => {
      // Una lista vacía puede ser «aún no hay ninguno» o un 403 degradado por
      // `unwrap`. Se distingue mirando si hay puestos: con puestos y sin un
      // solo límite, lo más probable es el permiso que falta.
      this.limits.set(limits);
      this.loading.set(false);
    });
  }

  positionName(jobPositionId: number): string {
    return this.positions().find(p => p.id === jobPositionId)?.name ?? `#${jobPositionId}`;
  }

  zoneOf(jobPositionId: number): string {
    return this.positions().find(p => p.id === jobPositionId)?.plantZoneName ?? '—';
  }

  warningThreshold(limit: ExposureLimit): number {
    return this.dosimetry.warningThreshold(limit);
  }

  /** Versiones anteriores de un puesto: el historial que no se borra. */
  historyCount(jobPositionId: number): number {
    return this.limits().filter(l => l.jobPositionId === jobPositionId).length - 1;
  }

  openForm(jobPositionId?: number): void {
    this.formPositionId = String(jobPositionId ?? this.positions()[0]?.id ?? '');
    this.formLimitIndex = '';
    this.formWarningRatio = '0.8';
    // Por defecto, vigente desde ahora: lo habitual al endurecer un límite.
    this.formEffectiveFrom = localDateTimeInput();
    this.formReferenceChoice = '';
    this.formReferenceOther = '';
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    const payload = {
      jobPositionId: Number(this.formPositionId),
      limitIndex: Number(this.formLimitIndex),
      warningRatio: Number(this.formWarningRatio),
      effectiveFrom: new Date(this.formEffectiveFrom).toISOString(),
      reference: limitReference(this.formReferenceChoice, this.formReferenceOther),
    };

    const error = this.dosimetry.validateLimit(payload);
    if (error) {
      this.toast.error(this.lang.t(`limits_invalid_${error}`));
      return;
    }

    const org = this.sso.organizationId();
    if (org === null) return;

    this.dosimetry.configureLimit(org, payload).subscribe(result => {
      if (!result.ok) {
        this.toast.error(describeError(key => this.lang.t(key), this.lang.t('limits_failed'), result.error));
        return;
      }
      this.activity.log('Exposure limit configured', this.positionName(payload.jobPositionId));
      this.toast.success(this.lang.t('plant_saved'));
      this.closeForm();
      this.reload();
    });
  }
}

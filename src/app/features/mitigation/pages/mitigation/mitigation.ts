import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { PlantConfigFacade } from '../../../../contexts/plantconfiguration/application/plant-config-facade';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import {
  MitigationAction,
  RelocationValidationError,
} from '../../../../contexts/occupationalhealth/domain/mitigation-action.model';
import { User } from '../../../../contexts/iam/domain/user.model';
import { JobPosition } from '../../../../contexts/plantconfiguration/domain/job-position.model';
import { PlantZone } from '../../../../contexts/plantconfiguration/domain/plant-zone.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';

type Tab = 'pending' | 'all';

/**
 * Bandeja de medidas de mitigación del responsable de SSO.
 *
 * Es el corazón de la fase: aquí una persona aprueba o rechaza lo que el
 * sistema propone. El informe lo trata como una firma con consecuencias, y por
 * eso **el ADMIN queda fuera** aunque administre el catálogo de la planta.
 *
 * Dos cosas que la pantalla tiene que respetar:
 *
 *  - **Rechazar exige motivo.** El backend lo valida con `@NotBlank`; aquí se
 *    bloquea el botón para no mandar una petición que iba a fallar.
 *  - **Una excedencia no dice a dónde mover al operario.** Ese destino lo pone
 *    la persona al aprobar, así que el formulario pide zona y puesto solo
 *    cuando falta — lo decide `needsTarget` en el dominio.
 */
@Component({
  selector: 'app-mitigation',
  imports: [TranslatePipe, FormsModule],
  templateUrl: './mitigation.html',
  styleUrl: './mitigation.scss',
})
export class Mitigation implements OnInit {
  private facade = inject(MitigationFacade);
  private plant = inject(PlantConfigFacade);
  private sso = inject(SsoFacade);
  private toast = inject(ToastService);
  private activity = inject(ActivityService);
  protected lang = inject(LanguageService);

  loading = signal(true);
  tab = signal<Tab>('pending');
  actions = signal<MitigationAction[]>([]);
  zones = signal<PlantZone[]>([]);
  positions = signal<JobPosition[]>([]);
  workers = signal<User[]>([]);

  pendingCount = computed(() => this.actions().filter(a => this.facade.isPending(a)).length);

  // ── Modal de decisión ────────────────────────────────────────────────────

  showDecision = signal(false);
  decisionAction = signal<MitigationAction | null>(null);
  decisionMode = signal<'approve' | 'reject'>('approve');

  /**
   * Los campos del formulario son **señales**, no propiedades sueltas.
   *
   * No es estilo: `positionsOfTarget` es un `computed` que depende de la zona
   * elegida, y un `computed` sin productores de señal se evalúa una vez y queda
   * cacheado para siempre — el desplegable de puestos no se habría rellenado
   * nunca. Por eso el enlace es `[ngModel]` + `(ngModelChange)` y no
   * `[(ngModel)]`: la escritura tiene que pasar por `set`.
   */
  decisionReason = signal('');
  targetZoneId = signal('');
  targetPositionId = signal('');

  /** Puestos de la zona elegida: un puesto pertenece a una sola zona. */
  positionsOfTarget = computed(() =>
    this.facade.positionsOfZone(this.positions(), Number(this.targetZoneId()) || null)
  );

  // ── Reubicación por decisión propia ──────────────────────────────────────

  showRelocation = signal(false);
  submitting = signal(false);
  relocWorkerId = signal('');
  relocZoneId = signal('');
  relocPositionId = signal('');
  relocJustification = signal('');

  positionsOfReloc = computed(() =>
    this.facade.positionsOfZone(this.positions(), Number(this.relocZoneId()) || null)
  );

  /** Qué falta por rellenar, o `null` si ya se puede enviar. */
  relocError = computed<RelocationValidationError>(() =>
    this.facade.validateRelocation({
      workerId: Number(this.relocWorkerId()) || undefined,
      toZoneId: Number(this.relocZoneId()) || undefined,
      toPositionId: Number(this.relocPositionId()) || undefined,
    })
  );

  ngOnInit(): void {
    this.plant.snapshot().subscribe(({ zones, positions }) => {
      this.zones.set(zones);
      this.positions.set(positions);
    });
    this.sso.workers().subscribe(workers => this.workers.set(workers));
    this.reload();
  }

  setTab(tab: Tab): void {
    this.tab.set(tab);
    this.reload();
  }

  private reload(): void {
    this.loading.set(true);
    const call = this.tab() === 'pending' ? this.facade.pending() : this.facade.all();
    call.subscribe(list => {
      this.actions.set(list);
      this.loading.set(false);
    });
  }

  isPending(action: MitigationAction): boolean {
    return this.facade.isPending(action);
  }

  needsTarget(action: MitigationAction): boolean {
    return this.facade.needsTarget(action);
  }

  stateLabelKey(action: MitigationAction): string {
    return this.facade.stateLabelKey(action);
  }

  workerIds(action: MitigationAction): number[] {
    return this.facade.workerIds(action);
  }

  openDecision(action: MitigationAction, mode: 'approve' | 'reject'): void {
    this.decisionAction.set(action);
    this.decisionMode.set(mode);
    this.decisionReason.set('');
    this.targetZoneId.set('');
    this.targetPositionId.set('');
    this.showDecision.set(true);
  }

  closeDecision(): void {
    this.showDecision.set(false);
  }

  /** Al cambiar de zona el puesto anterior deja de ser válido. */
  onTargetZoneChange(): void {
    this.targetPositionId.set('');
  }

  /** Rechazar exige motivo; aprobar con destino exige zona y puesto. */
  canSubmit(): boolean {
    const action = this.decisionAction();
    if (!action) return false;
    if (this.decisionMode() === 'reject') return this.decisionReason().trim().length > 0;
    if (this.needsTarget(action)) {
      return !!Number(this.targetZoneId()) && !!Number(this.targetPositionId());
    }
    return true;
  }

  submitDecision(): void {
    const action = this.decisionAction();
    if (!action || !this.canSubmit()) return;

    const done = (ok: unknown, logged: string) => {
      if (!ok) {
        this.toast.error(this.lang.t('mit_failed'));
        return;
      }
      this.activity.log(logged, `#${action.id}`);
      this.toast.success(this.lang.t('mit_done'));
      this.closeDecision();
      this.reload();
    };

    if (this.decisionMode() === 'reject') {
      this.facade.reject(action.id, { reason: this.decisionReason().trim() })
        .subscribe(r => done(r, 'Mitigation action rejected'));
      return;
    }

    this.facade.approve(action.id, {
      reason: this.decisionReason().trim() || undefined,
      toZoneId: Number(this.targetZoneId()) || undefined,
      toPositionId: Number(this.targetPositionId()) || undefined,
    }).subscribe(r => done(r, 'Mitigation action approved'));
  }

  // ── Reubicación por decisión propia ──────────────────────────────────────

  openRelocation(): void {
    this.relocWorkerId.set('');
    this.relocZoneId.set('');
    this.relocPositionId.set('');
    this.relocJustification.set('');
    this.showRelocation.set(true);
  }

  closeRelocation(): void {
    this.showRelocation.set(false);
  }

  onRelocZoneChange(): void {
    this.relocPositionId.set('');
  }

  /**
   * Aplica la reubicación.
   *
   * `submitting` bloquea el botón mientras la petición vuela. No sustituye a la
   * clave de idempotencia —un reintento del navegador no pasa por aquí—, pero
   * evita el caso corriente del doble clic.
   */
  submitRelocation(): void {
    if (this.relocError() || this.submitting()) return;
    this.submitting.set(true);

    const workerId = Number(this.relocWorkerId());
    const justification = this.relocJustification().trim();

    this.facade.registerRelocation({
      workerId,
      toZoneId: Number(this.relocZoneId()),
      toPositionId: Number(this.relocPositionId()),
      justification: justification || undefined,
    }).subscribe(action => {
      this.submitting.set(false);
      if (!action) {
        this.toast.error(this.lang.t('reloc_failed'));
        return;
      }
      this.activity.log('Worker relocated', `#${workerId}`);
      this.toast.success(this.lang.t('reloc_done'));
      this.closeRelocation();
      this.reload();
    });
  }
}

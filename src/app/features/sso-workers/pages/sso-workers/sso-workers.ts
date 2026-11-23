import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { SsoFacade } from '../../../../contexts/iam/application/sso-facade';
import { MitigationFacade } from '../../../../contexts/occupationalhealth/application/mitigation-facade';
import { User } from '../../../../contexts/iam/domain/user.model';
import { WorkerPlacement } from '../../../../contexts/occupationalhealth/domain/worker-shift.model';

/**
 * Los operarios de la organización del responsable de SSO.
 *
 * Solo los suyos: el backend acota por la organización del token y nunca
 * devuelve cuentas de otra empresa ni de otro rol. Es la única vista de personas
 * que tiene este portal — la administración global de usuarios es del ADMIN.
 *
 * Se cruza con el turno abierto para poder decir de un vistazo quién está en
 * planta ahora mismo, que es lo primero que un responsable quiere saber.
 */
@Component({
  selector: 'app-sso-workers',
  imports: [TranslatePipe],
  templateUrl: './sso-workers.html',
  styleUrl: './sso-workers.scss',
})
export class SsoWorkers implements OnInit {
  private sso = inject(SsoFacade);
  private mitigation = inject(MitigationFacade);

  loading = signal(true);
  workers = signal<User[]>([]);
  placements = signal<WorkerPlacement[]>([]);

  onShiftCount = computed(() => this.placements().filter(p => this.mitigation.isOnShift(p)).length);

  ngOnInit(): void {
    this.loading.set(true);
    this.sso.workers().subscribe(workers => {
      this.workers.set(workers);
      this.mitigation.placements().subscribe(placements => {
        this.placements.set(placements);
        this.loading.set(false);
      });
    });
  }

  private placementOf(workerId: number): WorkerPlacement | undefined {
    return this.placements().find(p => p.workerId === workerId);
  }

  isOnShift(workerId: number): boolean {
    const placement = this.placementOf(workerId);
    return placement ? this.mitigation.isOnShift(placement) : false;
  }

  zoneOf(workerId: number): number | null {
    return this.placementOf(workerId)?.shift?.currentPlantZoneId ?? null;
  }
}

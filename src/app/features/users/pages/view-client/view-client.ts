import { Component, inject, signal, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { UserFacade } from '../../../../contexts/iam/application/user-facade';
import { User, isCompanyClient } from '../../../../contexts/iam/domain/user.model';
import { DeviceFacade } from '../../../../contexts/devicemanagement/application/device-facade';
import { Device } from '../../../../contexts/devicemanagement/domain/device.model';

/**
 * Ficha de solo lectura del cliente: sus datos, sus dispositivos y, si es una
 * empresa, sus responsables de SSO.
 */
@Component({
  selector: 'app-view-client',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './view-client.html',
  styleUrl: './view-client.scss',
})
export class ViewClient implements OnInit {
  private route = inject(ActivatedRoute);
  private userFacade   = inject(UserFacade);
  private deviceFacade = inject(DeviceFacade);

  client  = signal<User | null>(null);
  devices = signal<Device[]>([]);
  ssoOfficers = signal<User[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.loading.set(false); return; }
    this.userFacade.byId(id).subscribe(u => {
      this.client.set(u);
      this.loading.set(false);
      if (u && isCompanyClient(u)) {
        this.userFacade.all().subscribe(list =>
          this.ssoOfficers.set(list.filter(x => x.role === 'SsoResponsible' && x.organizationId === u.id))
        );
      }
    });
    this.deviceFacade.ofClient(id).subscribe(d => this.devices.set(d));
  }

  protected deviceStatusLabel(status: string): string {
    const map: Record<string, string> = {
      'active': 'Active',
      'in-maintenance': 'In Maintenance',
      'requires-maintenance': 'Requires Maintenance',
      'unregistered': 'In Stock',
    };
    return map[status] ?? status;
  }

  protected isCompany(c: User): boolean {
    return isCompanyClient(c);
  }

  protected initials(name: string | undefined): string {
    return this.userFacade.initialsOf(name);
  }
}

import { Component, inject, signal, computed, OnInit, HostListener, DestroyRef, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LowerCasePipe } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { DeviceFacade } from '../../../../contexts/devicemanagement/application/device-facade';
import {
  Device, DeviceStatus, DeviceType, DEVICE_TYPES, EDITABLE_DEVICE_STATUSES, UNLINK_CLIENT, isEditableStatus, typeLabelFor,
} from '../../../../contexts/devicemanagement/domain/device.model';
import { DeviceManagementFacade } from '../../../../contexts/devicemanagement/application/device-management-facade';
import {
  DeviceStatusView, LIFECYCLE_STATUSES, LifecycleStatus, canDelete,
} from '../../../../contexts/devicemanagement/domain/device-status.model';
import { UserFacade } from '../../../../contexts/iam/application/user-facade';
import { User } from '../../../../contexts/iam/domain/user.model';
import { ToastService } from '../../../../core/services/toast.service';
import { ActivityService } from '../../../../core/services/activity.service';
import { LanguageService } from '../../../../core/services/language.service';
import { timeAgo } from '../../../../core/utils/time';

@Component({
  selector: 'app-devices',
  imports: [TranslatePipe, FormsModule, LowerCasePipe],
  templateUrl: './devices.html',
  styleUrl: './devices.scss',
})
export class Devices implements OnInit {
  private deviceFacade = inject(DeviceFacade);
  private dm           = inject(DeviceManagementFacade);
  private userFacade   = inject(UserFacade);
  private toast    = inject(ToastService);
  private activity = inject(ActivityService);
  private lang     = inject(LanguageService);
  private router   = inject(Router);
  private destroyRef = inject(DestroyRef);
  private platformId = inject(PLATFORM_ID);

  devices       = signal<Device[]>([]);
  /** Estado de Device Management por serial. */
  dmStatus      = signal<Map<string, DeviceStatusView>>(new Map());
  clients       = signal<User[]>([]);
  loading       = signal(true);
  showModal     = signal(false);
  editingDevice = signal<Device | null>(null);

  // Delete confirm modal
  showDeleteModal  = signal(false);
  deleteDeviceId   = signal<number | string | null>(null);

  // 3-dot menu
  openMenuId = signal<number | string | null>(null);

  // Filters
  searchQuery    = signal('');
  filterType     = signal('all');
  filterStatus   = signal('all');
  filterLifecycle = signal<'all' | LifecycleStatus>('all');
  readonly lifecycleStatuses = LIFECYCLE_STATUSES;

  // Pagination
  readonly pageSize = 10;
  currentPage = signal(0);

  readonly deviceTypes = DEVICE_TYPES;
  readonly editableStatuses = EDITABLE_DEVICE_STATUSES;
  readonly isEditableStatus = isEditableStatus;

  // Modal form fields
  formName        = '';
  formDeviceType: DeviceType = 'FIXED_SENSOR';
  formClientId: number | null = null;
  formLocation    = '';
  formStatus: DeviceStatus = 'active';
  formSerial      = '';
  formInstallDate = '';

  // Computed filtered list
  filtered = computed(() => {
    const q   = this.searchQuery().toLowerCase();
    const ty  = this.filterType();
    const st  = this.filterStatus();
    const lc  = this.filterLifecycle();
    return this.devices().filter(d => {
      const s = this.statusOf(d);
      const matchQ  = !q || d.name.toLowerCase().includes(q) || (d.serialNumber ?? '').toLowerCase().includes(q);
      const matchTy = ty === 'all' || s?.deviceType === ty;
      const matchSt = st === 'all' || d.status === st;
      const matchLc = lc === 'all' || s?.lifecycleStatus === lc;
      return matchQ && matchTy && matchSt && matchLc;
    });
  });

  /** Resumen del inventario por ciclo de vida. */
  lifecycleCounts = computed(() => {
    const counts: Record<LifecycleStatus, number> = { IN_STOCK: 0, INSTALLED: 0, RETIRED: 0 };
    for (const s of this.dmStatus().values()) {
      if (s.lifecycleStatus) counts[s.lifecycleStatus]++;
    }
    return counts;
  });

  totalPages  = computed(() => Math.ceil(this.filtered().length / this.pageSize));
  pagedItems  = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filtered().slice(start, start + this.pageSize);
  });

  pagesArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  min(a: number, b: number): number { return Math.min(a, b); }

  ngOnInit(): void {
    this.loadDevices();
    this.userFacade.all().subscribe(users => {
      this.clients.set(users.filter(u => u.role === 'Client'));
    });
    // En vivo: al llegar lecturas (/topic/readings) refresca conectividad y última lectura sin recargar.
    if (isPlatformBrowser(this.platformId)) {
      this.deviceFacade.readings()
        .pipe(debounceTime(1500), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refreshStatuses());
    }
  }

  private refreshStatuses(): void {
    const serials = this.devices().map(d => d.serialNumber);
    if (serials.length) this.dm.statuses(serials).subscribe(m => this.dmStatus.set(m));
  }

  private loadDevices(): void {
    this.loading.set(true);
    this.deviceFacade.all().subscribe(list => {
      this.devices.set(list);
      this.loading.set(false);
      this.dm.statuses(list.map(d => d.serialNumber)).subscribe(m => this.dmStatus.set(m));
    });
  }

  statusOf(d: Device): DeviceStatusView | undefined {
    return d.serialNumber ? this.dmStatus().get(d.serialNumber) : undefined;
  }

  canDeleteDevice(d: Device): boolean {
    return canDelete(this.statusOf(d));
  }

  openDetail(d: Device): void {
    this.openMenuId.set(null);
    this.router.navigate(['/admin/devices', d.id]);
  }

  lifecycleKey(status: LifecycleStatus | null | undefined): string {
    return status ? 'dm_lc_' + status : 'dm_unknown';
  }

  ago(iso: string | null | undefined): string {
    return timeAgo(iso);
  }

  onSearchChange(): void {
    this.currentPage.set(0);
  }

  onFilterChange(): void {
    this.currentPage.set(0);
  }

  // 3-dot menu
  toggleMenu(id: number | string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.set(this.openMenuId() === id ? null : id);
  }

  @HostListener('document:click')
  closeAllMenus(): void {
    this.openMenuId.set(null);
  }

  openCreate(): void {
    this.editingDevice.set(null);
    this.formName        = '';
    this.formDeviceType  = 'FIXED_SENSOR';
    this.formClientId    = null;
    this.formLocation    = '';
    this.formStatus      = 'active';
    this.formSerial      = '';
    this.formInstallDate = '';
    this.openMenuId.set(null);
    this.showModal.set(true);
  }

  openEdit(d: Device): void {
    this.editingDevice.set(d);
    this.formName        = d.name;
    this.formClientId    = d.clientId ?? null;
    this.formLocation    = d.location;
    this.formStatus      = d.status;
    this.formSerial      = d.serialNumber;
    this.formInstallDate = d.installDate ?? '';
    this.openMenuId.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  saveDevice(): void {
    const editing = this.editingDevice();
    if (!this.formName.trim() || (!editing && !this.formSerial.trim())) {
      this.toast.error('Name and serial number are required');
      return;
    }

    if (editing) {
      // El serial identifica al equipo en Device Management y no se edita.
      // Sin cliente se envía 0, que es lo que el backend entiende como desvincular.
      const payload = {
        name:        this.formName,
        type:        editing.type,
        location:    this.formLocation,
        status:      this.formStatus,
        installDate: this.formInstallDate || undefined,
        clientId:    this.formClientId ?? UNLINK_CLIENT,
      };
      this.deviceFacade.update(editing.id, payload).subscribe(updated => {
        if (updated) {
          this.activity.log('Device updated', this.formName);
          this.toast.success('Device updated successfully');
          this.closeModal();
          this.loadDevices();
        } else {
          this.toast.error('Failed to update device');
        }
      });
    } else {
      // Sin cliente queda en stock; el estado operativo lo decide el backend.
      const payload = {
        name:         this.formName,
        type:         typeLabelFor(this.formDeviceType),
        deviceType:   this.formDeviceType,
        location:     this.formLocation,
        serialNumber: this.formSerial.trim(),
        installDate:  this.formInstallDate || undefined,
        clientId:     this.formClientId,
      };
      this.deviceFacade.create(payload).subscribe(created => {
        if (created) {
          this.activity.log('Device created', this.formName);
          this.toast.success('Device created successfully');
          this.closeModal();
          this.loadDevices();
        } else {
          this.toast.error('Failed to create device');
        }
      });
    }
  }

  openDeleteConfirm(device: Device): void {
    if (!this.canDeleteDevice(device)) {
      this.openMenuId.set(null);
      this.toast.error(this.lang.t('dm_deleteBlocked'));
      return;
    }
    this.deleteDeviceId.set(device.id);
    this.showDeleteModal.set(true);
    this.openMenuId.set(null);
  }

  closeDeleteConfirm(): void {
    this.showDeleteModal.set(false);
    this.deleteDeviceId.set(null);
  }

  confirmDelete(): void {
    const id = this.deleteDeviceId();
    if (id == null) return;
    this.deviceFacade.remove(id).subscribe(() => {
      this.activity.log('Device deleted');
      this.toast.success('Device deleted');
      this.closeDeleteConfirm();
      this.loadDevices();
    });
  }

  viewClient(device: Device): void {
    this.openMenuId.set(null);
    if (device.clientId == null) {
      this.toast.error('This device has no associated client');
      return;
    }
    this.router.navigate(['/admin/users/view-client', device.clientId]);
  }

  createWorkOrder(device: Device): void {
    this.openMenuId.set(null);
    // Pre-fill a Maintenance work order for the device's associated client,
    // using the client's registered site as the location.
    const client = this.clients().find(c => c.id === device.clientId);
    const location = client?.address ?? client?.location ?? device.location ?? '';
    this.router.navigate(['/admin/work-orders/new'], {
      queryParams: {
        type: 'Maintenance',
        clientId: device.clientId ?? '',
        location,
      },
    });
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      'active':               'active',
      'unregistered':         'unregistered',
      'in-maintenance':       'in-maintenance',
      'requires-maintenance': 'requires-maintenance',
      'inactive':             'inactive',
    };
    return map[status] ?? 'unregistered';
  }

  statusKey(status: DeviceStatus | string): string {
    const map: Record<string, string> = {
      'active':               'dev_active',
      'unregistered':         'dev_unregistered',
      'in-maintenance':       'dev_inMaintenance',
      'requires-maintenance': 'dev_requiresMaintenance',
      'inactive':             'dev_inactive',
    };
    return map[status] ?? 'dev_unregistered';
  }

  deviceTypeKey(type: DeviceType): string {
    return 'dev_type_' + type;
  }
}

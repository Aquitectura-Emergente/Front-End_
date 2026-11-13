import { Component, inject, signal, computed, OnInit, HostListener } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { UserFacade } from '../../../../contexts/iam/application/user-facade';
import { User, isCompanyClient, isManagedByPanel } from '../../../../contexts/iam/domain/user.model';
import { ConfirmService } from '../../../../core/services/confirm.service';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';

type RoleFilter = 'all' | 'Admin' | 'Technician' | 'Client' | 'Company' | 'SsoResponsible';

@Component({
  selector: 'app-users',
  imports: [TranslatePipe, DecimalPipe],
  templateUrl: './users.html',
  styleUrl: './users.scss',
})
export class Users implements OnInit {
  private userFacade = inject(UserFacade);
  private router  = inject(Router);
  private confirm = inject(ConfirmService);
  private toast   = inject(ToastService);
  private lang    = inject(LanguageService);

  private _allUsers = signal<User[]>([]);
  loading      = signal(true);
  searchQuery  = signal('');
  activeTab    = signal<RoleFilter>('all');
  openMenuId: number | string | null = null;
  showAddModal = signal(false);

  // Pagination (10 users per page)
  currentPage = signal(0);
  readonly pageSize = 10;

  filteredUsers = computed(() => {
    let list = this._allUsers();
    const tab = this.activeTab();
    const q   = this.searchQuery().toLowerCase().trim();

    if (tab !== 'all') {
      list = tab === 'Company' ? list.filter(isCompanyClient) : list.filter(u => u.role === tab);
    }
    if (q) {
      list = list.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }
    return list;
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredUsers().length / this.pageSize)));

  pagedUsers = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredUsers().slice(start, start + this.pageSize);
  });

  hasActiveFilters = computed(() => this.activeTab() !== 'all' || this.searchQuery().trim().length > 0);

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages()) this.currentPage.set(page);
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  min(a: number, b: number): number {
    return Math.min(a, b);
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.currentPage.set(0);
  }

  clearFilters(): void {
    this.activeTab.set('all');
    this.searchQuery.set('');
    this.currentPage.set(0);
  }

  totalUsers         = computed(() => this._allUsers().length);
  activeNow          = computed(() => this._allUsers().filter(u => u.status === 'active').length);
  pendingCount       = computed(() => this._allUsers().filter(u => u.status === 'pending').length);
  activeClientCount  = computed(() => this._allUsers().filter(u => u.role === 'Client' && u.status === 'active').length);
  inactiveClientCount = computed(() => this._allUsers().filter(u => u.role === 'Client' && u.status === 'inactive').length);

  ngOnInit(): void {
    this.userFacade.all().subscribe(users => {
      this._allUsers.set(users.filter(isManagedByPanel));
      this.loading.set(false);
    });
  }

  roleKey(role: string): string {
    return 'role_' + role;
  }

  /** Empresa a la que pertenece una cuenta SSO. */
  orgName(user: User): string {
    if (user.organizationId == null) return '';
    return this._allUsers().find(u => u.id === user.organizationId)?.name ?? `#${user.organizationId}`;
  }

  setTab(tab: RoleFilter): void {
    this.activeTab.set(tab);
    this.currentPage.set(0);
  }

  openAdd(): void {
    this.showAddModal.set(true);
  }

  closeAdd(): void {
    this.showAddModal.set(false);
  }

  // Los clientes se registran desde la app móvil y un admin los activa, así que
  // aquí solo se crean admins, técnicos y responsables SSO de una empresa.
  addUser(type: 'Admin' | 'Technician' | 'SsoResponsible'): void {
    this.showAddModal.set(false);
    const routes: Record<string, string> = {
      Admin:          '/admin/users/new-admin',
      Technician:     '/admin/users/new-technician',
      SsoResponsible: '/admin/users/new-sso-responsible',
    };
    this.router.navigate([routes[type]]);
  }

  editUser(user: User): void {
    this.openMenuId = null;
    const routes: Record<string, string> = {
      Admin:      `/admin/users/edit-admin/${user.id}`,
      Technician: `/admin/users/edit-technician/${user.id}`,
      Client:     `/admin/users/edit-client/${user.id}`,
      SsoResponsible: `/admin/users/edit-sso-responsible/${user.id}`,
    };
    this.router.navigate([routes[user.role]]);
  }

  viewClient(user: User): void {
    this.openMenuId = null;
    this.router.navigate([`/admin/users/view-client/${user.id}`]);
  }

  toggleMenu(id: string | number, event: Event): void {
    event.stopPropagation();
    this.openMenuId = this.openMenuId === id ? null : id;
  }

  @HostListener('document:click')
  onDocClick(): void {
    this.openMenuId = null;
  }

  /** Approves a self-registered (pending) account so it can log in. */
  activateUser(user: User, event: Event): void {
    event.stopPropagation();
    this.openMenuId = null;
    this.userFacade.update(user.id, { status: 'active' }).subscribe(updated => {
      if (!updated) {
        this.toast.error(this.lang.t('users_activateFail'));
        return;
      }
      this._allUsers.update(list =>
        list.map(u => (String(u.id) === String(user.id) ? { ...u, status: 'active' } : u))
      );
      this.toast.success(this.lang.t('users_activated'));
    });
  }

  deleteUser(id: number | string, event: Event): void {
    event.stopPropagation();
    if (!this.confirm.confirm(this.lang.t('users_confirmDelete'))) return;
    this.userFacade.remove(id).subscribe(() => {
      this._allUsers.update(list => list.filter(u => String(u.id) !== String(id)));
      this.toast.success(this.lang.t('users_deleted'));
    });
    this.openMenuId = null;
  }

  formatJoinDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
}

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { UserFacade } from '../../../../contexts/iam/application/user-facade';
import { User, isCompanyClient } from '../../../../contexts/iam/domain/user.model';
import { MutationResult } from '../../../../core/http/api-response';
import { describeError } from '../../../../core/http/backend-error';
import { Observable } from 'rxjs';

/** Cuentas industriales que el admin crea para una empresa. */
type IndustrialRole = 'SSO_RESPONSIBLE' | 'WORKER';

function passwordsMatch(group: AbstractControl) {
  const pw = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw === cpw ? null : { mismatch: true };
}

/**
 * Alta y edición de una cuenta industrial de un cliente empresa: su responsable
 * de SSO o un operario (según `data.role` de la ruta). La empresa se fija al
 * crear la cuenta; el backend no permite cambiarla después. Al guardarla, el
 * backend le da su acceso a la dosimetría personal.
 */
@Component({
  selector: 'app-new-sso-responsible',
  imports: [ReactiveFormsModule, TranslatePipe, RouterLink, CommonModule],
  templateUrl: './new-sso-responsible.html',
  styleUrl: '../account-form.scss',
})
export class NewSsoResponsible implements OnInit {
  private fb     = inject(FormBuilder);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private users  = inject(UserFacade);
  private toast  = inject(ToastService);
  private lang   = inject(LanguageService);

  private userId: string | null = null;
  readonly role: IndustrialRole = this.route.snapshot.data['role'] === 'WORKER' ? 'WORKER' : 'SSO_RESPONSIBLE';
  readonly isWorker = this.role === 'WORKER';
  isEditMode = signal(false);
  companies  = signal<User[]>([]);
  editingOrgId = signal<number | null>(null);

  editingOrgName = computed(() =>
    this.companies().find(c => c.id === this.editingOrgId())?.name ?? (this.editingOrgId() != null ? `#${this.editingOrgId()}` : '—')
  );

  form = this.fb.group({
    organizationId:  [null as number | null, Validators.required],
    fullName:        ['', Validators.required],
    email:           ['', [Validators.required, Validators.email]],
    phone:           [''],
    department:      [''],
    password:        ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
    isActive:        [true],
    notes:           [''],
  }, { validators: passwordsMatch });

  submitted = false;
  saving = signal(false);
  showPassword = false;
  showConfirmPassword = false;

  ngOnInit(): void {
    this.users.all().subscribe(list => this.companies.set(list.filter(isCompanyClient)));

    const orgId = Number(this.route.snapshot.queryParamMap.get('organizationId'));
    if (orgId) this.form.patchValue({ organizationId: orgId });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.userId = id;
    this.isEditMode.set(true);
    for (const field of ['organizationId', 'password', 'confirmPassword']) {
      this.form.get(field)?.clearValidators();
      this.form.get(field)?.updateValueAndValidity();
    }
    this.users.byId(id).subscribe(user => {
      if (!user) return;
      this.editingOrgId.set(user.organizationId ?? null);
      this.form.patchValue({
        fullName: user.name,
        email:    user.email,
        phone:    user.phone ?? '',
        department: user.department ?? '',
        isActive: user.status === 'active',
        notes:    user.notes ?? '',
      });
    });
  }

  /** Clave de texto según el tipo de cuenta (`sso_*` o `wk_*`). */
  k(key: 'title' | 'editTitle' | 'sectionDesc' | 'sectionTitle' | 'info'): string {
    return (this.isWorker ? 'wk_' : 'sso_') + key;
  }

  isInvalid(field: string): boolean {
    const c = this.form.get(field);
    return !!(this.submitted && c && c.invalid);
  }

  get passwordMismatch(): boolean {
    return !!(this.submitted && this.form.hasError('mismatch'));
  }

  submit(): void {
    this.submitted = true;
    if (this.form.invalid) return;
    const v = this.form.value;
    const name = v.fullName ?? '';
    this.saving.set(true);

    const request: Observable<MutationResult<User>> = this.userId
      ? this.users.change(this.userId, {
          name,
          email:  v.email ?? '',
          phone:  v.phone ?? '',
          ...(this.isWorker ? { department: v.department ?? '' } : {}),
          status: v.isActive ? 'active' : 'inactive',
          notes:  v.notes ?? '',
        })
      : this.users.save({
          name,
          initials:       this.users.initialsOf(name),
          email:          v.email ?? '',
          password:       v.password ?? '',
          role:           this.role,
          organizationId: v.organizationId ?? undefined,
          phone:          v.phone || undefined,
          department:     this.isWorker ? v.department || undefined : undefined,
          notes:          v.notes || undefined,
        });

    const prefix = this.isWorker ? 'wk_' : 'sso_';
    request.subscribe(result => {
      this.saving.set(false);
      if (!result.ok) {
        const title = this.lang.t(this.isWorker ? 'wk_saveFailed' : 'sso_saveFailedShort');
        this.toast.error(describeError(key => this.lang.t(key), title, result.error));
        return;
      }
      this.toast.success(this.lang.t(prefix + (this.userId ? 'updated' : 'created')));
      this.cancel();
    });
  }

  cancel(): void {
    const org = this.editingOrgId() ?? this.form.value.organizationId;
    if (org) this.router.navigate(['/admin/users/view-client', org]);
    else this.router.navigate(['/admin/users']);
  }
}

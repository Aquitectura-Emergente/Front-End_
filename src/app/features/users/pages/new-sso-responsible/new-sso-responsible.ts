import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../../../core/pipes/translate.pipe';
import { ToastService } from '../../../../core/services/toast.service';
import { LanguageService } from '../../../../core/services/language.service';
import { UserFacade } from '../../../../contexts/iam/application/user-facade';
import { User, isCompanyClient } from '../../../../contexts/iam/domain/user.model';

function passwordsMatch(group: AbstractControl) {
  const pw = group.get('password')?.value;
  const cpw = group.get('confirmPassword')?.value;
  return pw === cpw ? null : { mismatch: true };
}

/**
 * Alta y edición del responsable de SSO de un cliente empresa. La empresa se
 * fija al crear la cuenta; el backend no permite cambiarla después.
 */
@Component({
  selector: 'app-new-sso-responsible',
  imports: [ReactiveFormsModule, TranslatePipe, RouterLink, CommonModule],
  templateUrl: './new-sso-responsible.html',
  styleUrl: '../new-technician/new-technician.scss',
})
export class NewSsoResponsible implements OnInit {
  private fb     = inject(FormBuilder);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private users  = inject(UserFacade);
  private toast  = inject(ToastService);
  private lang   = inject(LanguageService);

  private userId: string | null = null;
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
        isActive: user.status === 'active',
        notes:    user.notes ?? '',
      });
    });
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

    const request = this.userId
      ? this.users.update(this.userId, {
          name,
          email:  v.email ?? '',
          phone:  v.phone ?? '',
          status: v.isActive ? 'active' : 'inactive',
          notes:  v.notes ?? '',
        })
      : this.users.create({
          name,
          initials:       this.users.initialsOf(name),
          email:          v.email ?? '',
          password:       v.password ?? '',
          role:           'SSO_RESPONSIBLE',
          organizationId: v.organizationId ?? undefined,
          phone:          v.phone || undefined,
          notes:          v.notes || undefined,
        });

    request.subscribe(saved => {
      this.saving.set(false);
      if (!saved) {
        this.toast.error(this.lang.t('sso_saveFailed'));
        return;
      }
      this.toast.success(this.lang.t(this.userId ? 'sso_updated' : 'sso_created'));
      this.cancel();
    });
  }

  cancel(): void {
    const org = this.editingOrgId() ?? this.form.value.organizationId;
    if (org) this.router.navigate(['/admin/users/view-client', org]);
    else this.router.navigate(['/admin/users']);
  }
}

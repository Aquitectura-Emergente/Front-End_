import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../../../core/services/language.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { AuthService } from '../../../contexts/iam/application/auth.service';
import { homeRouteFor } from '../../../contexts/iam/domain/auth-user.model';
import { ThemeService, FontSize } from '../../../core/services/theme.service';
import { ActivityService } from '../../../core/services/activity.service';
import { LayoutService } from '../../../core/services/layout.service';

@Component({
  selector: 'app-topbar',
  imports: [TranslatePipe, RouterLink],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  protected lang     = inject(LanguageService);
  protected auth     = inject(AuthService);
  protected theme    = inject(ThemeService);
  protected activity = inject(ActivityService);
  protected layout   = inject(LayoutService);

  showBellPanel    = signal(false);
  showProfileMenu  = signal(false);

  @HostListener('document:click')
  closeAll(): void {
    this.showProfileMenu.set(false);
    this.showBellPanel.set(false);
  }

  toggleProfileMenu(e: Event): void {
    e.stopPropagation();
    const next = !this.showProfileMenu();
    this.showProfileMenu.set(next);
    if (next) this.showBellPanel.set(false);
  }

  openBell(e: Event): void {
    e.stopPropagation();
    this.showBellPanel.set(true);
    this.showProfileMenu.set(false);
  }

  closeBell(): void {
    this.showBellPanel.set(false);
  }

  setFontSize(size: FontSize, e: Event): void {
    e.stopPropagation();
    this.theme.setFontSize(size);
  }

  toggleDark(e: Event): void {
    e.stopPropagation();
    this.theme.toggleDarkMode();
  }

  /**
   * El perfil vive dentro del árbol de cada rol, así que la ruta se deriva de
   * `homeRouteFor` en vez de encadenar ternarios. Antes era
   * `admin ? '/admin/profile' : '/tech/profile'`, y al añadir el portal de SSO
   * eso mandaba al responsable a `/tech/profile`, donde el `techGuard` lo
   * rechazaba y acababa de vuelta en el login.
   */
  get profileRoute(): string {
    const role = this.auth.currentUser()?.role;
    return role ? `${homeRouteFor(role)}/profile` : '/login';
  }

  /** Etiqueta del rol bajo el nombre. Un ternario no da para tres roles. */
  get roleLabelKey(): string {
    switch (this.auth.currentUser()?.role) {
      case 'admin': return 'topbar_role';
      case 'technician': return 'topbar_role_tech';
      case 'sso_responsible': return 'topbar_role_sso';
      default: return 'topbar_role';
    }
  }
}

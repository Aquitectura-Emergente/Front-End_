import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

import { SsoSidebar } from '../../shared/layout/sso-sidebar/sso-sidebar';
import { Topbar } from '../../shared/layout/topbar/topbar';
import { ToastComponent } from '../../shared/components/toast/toast.component';
import { LayoutService } from '../../core/services/layout.service';

/**
 * Portal del responsable de SSO: el tercer árbol de rutas, junto a admin y
 * técnico.
 *
 * Reutiliza la rejilla y el drawer del portal técnico —mismos estilos, misma
 * `LayoutService`— porque el comportamiento del contenedor es idéntico; lo único
 * propio es la navegación.
 */
@Component({
  selector: 'app-sso-layout',
  imports: [RouterOutlet, SsoSidebar, Topbar, ToastComponent],
  templateUrl: './sso-layout.html',
  styleUrl: './sso-layout.scss',
})
export class SsoLayout {
  protected layout = inject(LayoutService);
  private router = inject(Router);

  constructor() {
    // Cierra el drawer al navegar (en móvil/tablet).
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.layout.close());
  }
}

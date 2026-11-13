import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { LanguageService } from '../../../core/services/language.service';
import { AuthService } from '../../../contexts/iam/application/auth.service';

/** Navegación del portal del responsable de SSO. */
@Component({
  selector: 'app-sso-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './sso-sidebar.html',
  styleUrl: './sso-sidebar.scss',
})
export class SsoSidebar {
  protected lang = inject(LanguageService);
  protected auth = inject(AuthService);
}

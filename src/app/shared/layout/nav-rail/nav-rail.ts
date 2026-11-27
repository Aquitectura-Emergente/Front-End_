import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../contexts/iam/application/auth.service';
import { BrandMark } from '../../ui/brand-mark/brand-mark';

export interface NavItem {
  route: string;
  icon: string;
  labelKey: string;
  exact?: boolean;
}

export interface NavSection {
  labelKey?: string;
  items: NavItem[];
}

/** Rail de navegación común a los tres portales; cada portal aporta sus secciones. */
@Component({
  selector: 'app-nav-rail',
  imports: [RouterLink, RouterLinkActive, TranslatePipe, BrandMark],
  templateUrl: './nav-rail.html',
  styleUrl: './nav-rail.scss',
})
export class NavRail {
  readonly portalKey = input.required<string>();
  readonly ariaLabel = input('Navigation');
  readonly sections = input.required<NavSection[]>();

  protected layout = inject(LayoutService);
  protected auth = inject(AuthService);
}

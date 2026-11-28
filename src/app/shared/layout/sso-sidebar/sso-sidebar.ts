import { Component } from '@angular/core';
import { NavRail, NavSection } from '../nav-rail/nav-rail';

@Component({
  selector: 'app-sso-sidebar',
  imports: [NavRail],
  template: `<app-nav-rail portalKey="nav_ssoPortal" ariaLabel="SSO navigation" [sections]="sections" />`,
  styles: `:host { display: block; height: 100%; }`,
})
export class SsoSidebar {
  protected readonly sections: NavSection[] = [
    {
      labelKey: 'shell_group_overview',
      items: [
        { route: '/sso', icon: 'ph-map-trifold', labelKey: 'nav_plantMap', exact: true },
        { route: '/sso/alerts', icon: 'ph-siren', labelKey: 'nav_alerts' },
      ],
    },
    {
      labelKey: 'shell_group_exposure',
      items: [
        { route: '/sso/risk-workers', icon: 'ph-trend-up', labelKey: 'nav_risk_workers' },
        { route: '/sso/exposure-analytics', icon: 'ph-chart-line', labelKey: 'nav_exposure_analytics' },
        { route: '/sso/workers', icon: 'ph-users-three', labelKey: 'nav_workers' },
        { route: '/sso/exposure', icon: 'ph-pulse', labelKey: 'nav_exposure' },
      ],
    },
    {
      labelKey: 'shell_group_compliance',
      items: [
        { route: '/sso/mitigation', icon: 'ph-clipboard-text', labelKey: 'nav_mitigation' },
        { route: '/sso/limits', icon: 'ph-gauge', labelKey: 'nav_limits' },
        { route: '/sso/reports', icon: 'ph-file-text', labelKey: 'nav_reports' },
      ],
    },
    {
      labelKey: 'shell_group_plant',
      items: [
        { route: '/sso/plant-config', icon: 'ph-factory', labelKey: 'nav_plantConfig' },
        { route: '/sso/profile', icon: 'ph-user', labelKey: 'nav_profile' },
      ],
    },
  ];
}
